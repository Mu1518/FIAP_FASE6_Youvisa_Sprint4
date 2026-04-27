'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ConfirmModal from '@/components/ConfirmModal';
import ProcessoTimeline from '@/components/ProcessoTimeline';
import {
  getDocumentoDownloadUrl,
  atualizarHandoff,
  analisarCaso,
  criarRequisito,
  atualizarRequisito,
  excluirRequisito,
  Processo,
  Transicao,
  Documento,
  SolicitacaoDocumento,
  Handoff,
  HandoffMensagem,
  AnaliseCaso,
  RequisitoVisto,
  RequisitoVistoPayload,
} from '@/lib/api';
import {
  useProcessosAdmin,
  useHandoffsAdmin,
  useHandoffMensagens,
  useDocumentosAdmin,
  useSolicitacoes,
  useHistorico,
  useTransicoes,
  useRequisitos,
} from '@/hooks/use-queries';
import {
  useAtualizarStatus,
  useAvaliarDocumento,
  useAprovarDocumentoIA,
  useEnviarMensagemHandoff,
  useSolicitarDocumentos,
} from '@/hooks/use-mutations';
import { useSSE, useHandoffSSE } from '@/hooks/use-sse';
import { ProcessoRowSkeleton, HandoffCardSkeleton } from '@/components/Skeleton';
import AlertMessage from '@/components/AlertMessage';
import { formatDateOnlyPtBr } from '@/lib/utils';
import { getCountryFlag } from '@/lib/country-flags';

const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  passaporte: 'Passaporte',
  foto: 'Foto 3x4',
  comprovante_financeiro: 'Comprovante Financeiro',
  carta_convite: 'Carta Convite',
  seguro_viagem: 'Seguro Viagem',
  comprovante_matricula: 'Comprovante de Matrícula',
  contrato_trabalho: 'Contrato de Trabalho',
  comprovante_residencia: 'Comprovante de Residência',
  certidao_nascimento: 'Certidão de Nascimento',
  certidao_casamento: 'Certidão de Casamento',
  antecedentes_criminais: 'Antecedentes Criminais',
  exame_medico: 'Exame Médico',
  formulario_ds160: 'Formulário DS-160',
  comprovante_pagamento_taxa: 'Comprovante de Pagamento de Taxa',
  outro: 'Outro',
};

const TIPOS_DOCUMENTO_OPTIONS = Object.entries(TIPO_DOCUMENTO_LABELS).map(([value, label]) => ({ value, label }));

const STATUS_DOC_BADGES: Record<string, { label: string; cor: string; icone: string }> = {
  pendente_revisao: { label: 'Em Revisão', cor: 'bg-yellow-100 text-yellow-700', icone: 'schedule' },
  aprovado: { label: 'Aprovado', cor: 'bg-emerald-100 text-emerald-800', icone: 'check_circle' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-700', icone: 'cancel' },
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, { label: string; cor: string }> = {
  recebido: { label: 'Recebido', cor: 'bg-[#cfe6f2] text-[#071e27]' },
  em_analise: { label: 'Em Análise', cor: 'bg-[#ffdea5] text-[#3d2a00]' },
  documentos_pendentes: { label: 'Documentos Pendentes', cor: 'bg-[#ffdad6] text-[#93000a]' },
  em_processamento: { label: 'Em Processamento', cor: 'bg-[#a0f2e1] text-[#00201b]' },
  aprovado: { label: 'Aprovado', cor: 'bg-emerald-100 text-emerald-800' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-[#ffdad6] text-[#93000a]' },
  cancelado: { label: 'Cancelado', cor: 'bg-[#e4e2df] text-[#3f4945]' },
};

const TIPO_LABELS: Record<string, string> = {
  visto_turista: 'Visto de Turista',
  visto_estudante: 'Visto de Estudante',
  visto_trabalho: 'Visto de Trabalho',
  imigracao: 'Imigração',
  intercambio: 'Intercâmbio de Idiomas',
};

function formatDateShortPtBr(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export default function AdminDashboardContent() {
  const { t } = useI18n();
  const { adminUsuario: usuario, adminToken: token, logoutAdmin: logout, carregando: authCarregando } = useAuth();
  useSSE(token, 'admin');
  const processosQuery = useProcessosAdmin(token);
  const processos = processosQuery.data?.processos ?? [];
  const carregando = processosQuery.isLoading;
  const router = useRouter();

  // Expanded row
  const [processoExpandido, setProcessoExpandido] = useState<number | null>(null);
  const processoExpandidoRef = useRef<number | null>(null);

  // Query hooks for expanded process details
  const transicoesQuery = useTransicoes(token, processoExpandido);
  const historicoQuery = useHistorico(token, processoExpandido);
  const documentosQuery = useDocumentosAdmin(token, processoExpandido);
  const solicitacoesQuery = useSolicitacoes(token, processoExpandido);

  // Status update form
  const [novoStatus, setNovoStatus] = useState<Record<number, string>>({});
  const [observacao, setObservacao] = useState<Record<number, string>>({});
  const [atualizando, setAtualizando] = useState<number | null>(null);
  const statusMutation = useAtualizarStatus(token);
  const avaliarMutation = useAvaliarDocumento(token);
  const aprovarIAMutation = useAprovarDocumentoIA(token);
  const enviarMensagemMutation = useEnviarMensagemHandoff(token);
  const solicitarDocsMutation = useSolicitarDocumentos(token);

  // Confirmation modal
  const [confirmacao, setConfirmacao] = useState<{
    processoId: number;
    status: string;
    observacao: string;
    clienteNome: string;
  } | null>(null);

  // Avaliação de documento
  const [avaliacaoAberta, setAvaliacaoAberta] = useState<{ docId: number; processoId: number; acao: 'aprovado' | 'rejeitado' } | null>(null);
  const [feedbackAvaliacao, setFeedbackAvaliacao] = useState('');
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [analisandoIaDocId, setAnalisandoIaDocId] = useState<number | null>(null);

  // Solicitações de documentos
  const [mostrarSolicitarDocs, setMostrarSolicitarDocs] = useState<number | null>(null);
  const [itensSolicitacao, setItensSolicitacao] = useState<Array<{ tipo_documento: string; descricao: string; obrigatoria: boolean }>>([]);
  const [novoTipoSolicitacao, setNovoTipoSolicitacao] = useState('');
  const [novaDescSolicitacao, setNovaDescSolicitacao] = useState('');
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);

  // Messages
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Copiloto de Prontidão
  const [analisandoCaso, setAnalisandoCaso] = useState<number | null>(null);
  const [analises, setAnalises] = useState<Record<number, AnaliseCaso>>({});
  const [mostrarAnalise, setMostrarAnalise] = useState<number | null>(null);

  // Requisitos de Visto
  const requisitosQuery = useRequisitos(token);
  const requisitos = requisitosQuery.data?.requisitos ?? [];
  const carregandoRequisitos = requisitosQuery.isLoading;
  const [editandoRequisito, setEditandoRequisito] = useState<RequisitoVisto | null>(null);
  const [novoRequisito, setNovoRequisito] = useState(false);
  const [formRequisito, setFormRequisito] = useState<RequisitoVistoPayload>({
    tipo_visto: '',
    pais_destino: '',
    documentos_obrigatorios: ['passaporte', 'foto'],
    validade_minima_passaporte_meses: 6,
    ativo: true,
  });
  const [salvandoRequisito, setSalvandoRequisito] = useState(false);

  // Tab: processos vs atendimentos vs requisitos
  const [abaAtiva, setAbaAtiva] = useState<'processos' | 'atendimentos' | 'requisitos'>('processos');

  // Filter & search
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [buscaHandoff, setBuscaHandoff] = useState('');
  const [filtroTipoRequisito, setFiltroTipoRequisito] = useState<string>('todos');

  // Handoff state
  const handoffsQuery = useHandoffsAdmin(token);
  const handoffs = handoffsQuery.data?.handoffs ?? [];
  const [handoffAberto, setHandoffAberto] = useState<number | null>(null);
  const handoffMensagensQuery = useHandoffMensagens(token, handoffAberto);
  const handoffMensagens = handoffMensagensQuery.data?.mensagens ?? [];
  useHandoffSSE(token, handoffAberto);
  const [handoffMsgInput, setHandoffMsgInput] = useState('');
  const [handoffEnviando, setHandoffEnviando] = useState(false);
  const [handoffEncerrando, setHandoffEncerrando] = useState(false);
  const [handoffCarregando, setHandoffCarregando] = useState(false);

  // Filtered requisitos
  const requisitosFiltrados = useMemo(() => {
    if (filtroTipoRequisito === 'todos') return requisitos;
    return requisitos.filter((r) => r.tipo_visto === filtroTipoRequisito);
  }, [requisitos, filtroTipoRequisito]);

  const requisitosAtivos = useMemo(() => requisitos.filter((r) => r.ativo).length, [requisitos]);

  // Filtered handoffs
  const handoffsFiltrados = useMemo(() => {
    if (!buscaHandoff.trim()) return handoffs;
    const termo = buscaHandoff.toLowerCase();
    return handoffs.filter(
      (h) =>
        (h.nome_usuario && h.nome_usuario.toLowerCase().includes(termo)) ||
        (h.email_usuario && h.email_usuario.toLowerCase().includes(termo))
    );
  }, [handoffs, buscaHandoff]);

  // Active handoff data helper
  const handoffAtivoData = useMemo(() => {
    if (!handoffAberto) return null;
    return handoffs.find(h => h.id === handoffAberto) || null;
  }, [handoffs, handoffAberto]);

  // Filtered processes
  const processosFiltrados = useMemo(() => {
    let resultado = processos;
    if (filtroStatus !== 'todos') {
      resultado = resultado.filter((p) => p.status === filtroStatus);
    }
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(
        (p) =>
          p.usuario_nome.toLowerCase().includes(termo) ||
          p.nome_completo?.toLowerCase().includes(termo) ||
          p.id.toString().includes(termo) ||
          (p.pais_destino && p.pais_destino.toLowerCase().includes(termo))
      );
    }
    return resultado;
  }, [processos, filtroStatus, busca]);

  // Stats
  const statsEmAberto = useMemo(() => processos.filter((p) => !['aprovado', 'rejeitado', 'cancelado'].includes(p.status)).length, [processos]);
  const statsAprovados = useMemo(() => {
    if (processos.length === 0) return 0;
    return Math.round((processos.filter((p) => p.status === 'aprovado').length / processos.length) * 100);
  }, [processos]);

  useEffect(() => {
    if (authCarregando) return;
    if (!token || !usuario) {
      router.push('/admin');
      return;
    }
    if (usuario.tipo !== 'funcionario') {
      router.push('/dashboard');
      return;
    }
  }, [token, usuario, authCarregando, router]);

  function abrirHandoff(handoffId: number) {
    setHandoffAberto(handoffId);
    setHandoffCarregando(true);
    setTimeout(() => setHandoffCarregando(false), 300);
  }

  async function handleEnviarMsgHandoff(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !handoffAberto || !handoffMsgInput.trim()) return;
    setHandoffEnviando(true);
    try {
      await enviarMensagemMutation.mutateAsync({ handoffId: handoffAberto, conteudo: handoffMsgInput.trim() });
      setHandoffMsgInput('');
      handoffsQuery.refetch();
    } catch {
      setErro(t('Erro ao enviar mensagem'));
    } finally {
      setHandoffEnviando(false);
    }
  }

  async function handleEncerrarHandoff(handoffId: number) {
    if (!token || handoffEncerrando) return;
    setHandoffEncerrando(true);
    try {
      await atualizarHandoff(token, handoffId, 'resolvido');
      setHandoffAberto(null);
      handoffsQuery.refetch();
      setSucesso(t('Atendimento encerrado com sucesso'));
    } catch {
      setErro(t('Erro ao encerrar atendimento'));
    } finally {
      setHandoffEncerrando(false);
    }
  }

  async function handleAnalisarCaso(processoId: number) {
    if (!token || analisandoCaso) return;
    setAnalisandoCaso(processoId);
    setErro('');
    setSucesso('');
    try {
      const resultado = await analisarCaso(token, processoId);
      setAnalises((prev) => ({ ...prev, [processoId]: resultado }));
      setMostrarAnalise(processoId);
      setSucesso(`${t('Análise do caso')} #${processoId} ${t('concluída! Pontuação:')} ${resultado.pontuacao}/100`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao analisar caso'));
    } finally {
      setAnalisandoCaso(null);
    }
  }

  async function handleSalvarRequisito() {
    if (!token || !formRequisito.tipo_visto || !formRequisito.pais_destino) return;
    setSalvandoRequisito(true);
    setErro('');
    try {
      if (editandoRequisito) {
        await atualizarRequisito(token, editandoRequisito.id, formRequisito);
        setSucesso(t('Requisito atualizado com sucesso!'));
      } else {
        await criarRequisito(token, formRequisito);
        setSucesso(t('Requisito criado com sucesso!'));
      }
      setEditandoRequisito(null);
      setNovoRequisito(false);
      setFormRequisito({ tipo_visto: '', pais_destino: '', documentos_obrigatorios: ['passaporte', 'foto'], validade_minima_passaporte_meses: 6, ativo: true });
      requisitosQuery.refetch();
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao salvar requisito'));
    } finally {
      setSalvandoRequisito(false);
    }
  }

  async function handleExcluirRequisito(id: number) {
    if (!token) return;
    try {
      await excluirRequisito(token, id);
      setSucesso(t('Requisito excluído com sucesso!'));
      requisitosQuery.refetch();
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao excluir requisito'));
    }
  }

  function iniciarEdicaoRequisito(req: RequisitoVisto) {
    setEditandoRequisito(req);
    setNovoRequisito(false);
    setFormRequisito({
      tipo_visto: req.tipo_visto,
      pais_destino: req.pais_destino,
      documentos_obrigatorios: req.documentos_obrigatorios,
      validade_minima_passaporte_meses: req.validade_minima_passaporte_meses,
      regras_adicionais: req.regras_adicionais,
      ativo: req.ativo,
    });
  }

  async function handleDownload(processoId: number, docId: number, nomeOriginal: string) {
    if (!token) return;
    try {
      const url = getDocumentoDownloadUrl(processoId, docId);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Erro ao baixar');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nomeOriginal;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao baixar documento'));
    }
  }

  async function handleAvaliarDocumento() {
    if (!token || !avaliacaoAberta) return;
    setEnviandoAvaliacao(true);
    try {
      await avaliarMutation.mutateAsync({
        processoId: avaliacaoAberta.processoId,
        documentoId: avaliacaoAberta.docId,
        status: avaliacaoAberta.acao,
        feedback: feedbackAvaliacao || undefined,
      });
      setSucesso(`${t('Documento')} ${avaliacaoAberta.acao === 'aprovado' ? t('aprovado') : t('rejeitado')} ${t('com sucesso!')}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao avaliar documento'));
    } finally {
      setEnviandoAvaliacao(false);
      setAvaliacaoAberta(null);
      setFeedbackAvaliacao('');
    }
  }

  async function handleAprovarComIA(processoId: number, documentoId: number) {
    if (!token) return;
    setAnalisandoIaDocId(documentoId);
    setErro('');
    setSucesso('');
    try {
      const res = await aprovarIAMutation.mutateAsync({ processoId, documentoId });
      setSucesso(
        res.documento.status === 'aprovado'
          ? t('Documento aprovado com IA com sucesso!')
          : t('Documento rejeitado pela IA.')
      );
    } catch (err) {
      const erroDetalhado = err as Error & { status?: number; details?: unknown };
      console.error('[Admin IA] Falha na aprovação com IA', {
        processoId,
        documentoId,
        mensagem: erroDetalhado?.message,
        status: erroDetalhado?.status,
        details: erroDetalhado?.details,
        erro: err,
      });
      setErro(err instanceof Error ? err.message : t('Erro ao aprovar documento com IA'));
    } finally {
      setAnalisandoIaDocId(null);
    }
  }

  async function handleEnviarSolicitacoes(processoId: number) {
    if (!token || itensSolicitacao.length === 0) return;
    setEnviandoSolicitacao(true);
    try {
      await solicitarDocsMutation.mutateAsync({ processoId, documentos: itensSolicitacao });
      setItensSolicitacao([]);
      setMostrarSolicitarDocs(null);
      setSucesso(t('Documentos solicitados com sucesso! O cliente foi notificado por e-mail.'));
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao solicitar documentos'));
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  function toggleProcesso(processoId: number) {
    if (processoExpandido === processoId) {
      setProcessoExpandido(null);
      processoExpandidoRef.current = null;
    } else {
      setProcessoExpandido(processoId);
      processoExpandidoRef.current = processoId;
    }
  }

  function pedirConfirmacao(processoId: number, clienteNome: string) {
    const status = novoStatus[processoId];
    if (!status) return;
    setConfirmacao({
      processoId,
      status,
      observacao: observacao[processoId] || '',
      clienteNome,
    });
  }

  const confirmarAtualizacao = useCallback(async () => {
    if (!token || !confirmacao) return;
    const { processoId, status, observacao: obs } = confirmacao;
    setConfirmacao(null);
    setAtualizando(processoId);
    setErro('');
    setSucesso('');

    try {
      await statusMutation.mutateAsync({ processoId, status, observacao: obs || undefined });
      setSucesso(`${t('Status do processo')} #${processoId} ${t('atualizado para')} "${t(STATUS_LABELS[status]?.label || status)}" ${t('com sucesso!')}`);
      setNovoStatus((prev) => ({ ...prev, [processoId]: '' }));
      setObservacao((prev) => ({ ...prev, [processoId]: '' }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao atualizar status'));
    } finally {
      setAtualizando(null);
    }
  }, [token, confirmacao, statusMutation]);

  if (authCarregando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f6]">
        <div className="text-[#4c616c] font-[Manrope]">{t('Carregando...')}</div>
      </div>
    );
  }

  const FILTER_BUTTONS = [
    { key: 'todos', label: 'Todos' },
    { key: 'em_processamento', label: 'Em Processamento' },
    { key: 'aprovado', label: 'Aprovado' },
    { key: 'documentos_pendentes', label: 'Pendente' },
    { key: 'recebido', label: 'Recebido' },
    { key: 'em_analise', label: 'Em Análise' },
  ];

  return (
    <>
      <main className="min-h-screen flex flex-col bg-[#fbf9f6] text-[#1b1c1a]">
        {/* Top Navigation Bar */}
        <header className="bg-[#fbf9f6] sticky top-0 z-50 shadow-sm border-b border-stone-200/20">
          <div className="flex justify-between items-center px-4 md:px-8 h-16 w-full max-w-[1440px] mx-auto">
            <div className="flex items-center gap-6 md:gap-12">
              {/* Branding */}
              <Link href="/admin/dashboard" className="flex items-center gap-3">
                <span className="font-serif tracking-tighter text-2xl font-bold text-[#00342d]">YouVisa</span>
                <span className="bg-[#00342d] text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-tight uppercase">Admin</span>
              </Link>
              {/* Horizontal Tab Navigation */}
              <nav className="hidden md:flex gap-8">
                <button
                  onClick={() => setAbaAtiva('processos')}
                  className={`font-serif tracking-tight pb-1 transition-colors ${
                    abaAtiva === 'processos'
                      ? 'text-[#00342d] font-bold border-b-2 border-[#00342d]'
                      : 'text-[#4c616c] font-medium hover:text-[#00342d]'
                  }`}
                >
                  {t('Processos')}
                </button>
                <button
                  onClick={() => { setAbaAtiva('atendimentos'); handoffsQuery.refetch(); }}
                  className={`font-serif tracking-tight pb-1 transition-colors flex items-center gap-2 ${
                    abaAtiva === 'atendimentos'
                      ? 'text-[#00342d] font-bold border-b-2 border-[#00342d]'
                      : 'text-[#4c616c] font-medium hover:text-[#00342d]'
                  }`}
                >
                  {t('Atendimentos')}
                  {handoffs.filter(h => h.status !== 'resolvido').length > 0 && (
                    <span className="bg-[#ba1a1a] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {handoffs.filter(h => h.status !== 'resolvido').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setAbaAtiva('requisitos'); requisitosQuery.refetch(); }}
                  className={`font-serif tracking-tight pb-1 transition-colors ${
                    abaAtiva === 'requisitos'
                      ? 'text-[#00342d] font-bold border-b-2 border-[#00342d]'
                      : 'text-[#4c616c] font-medium hover:text-[#00342d]'
                  }`}
                >
                  {t('Requisitos')}
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <button className="flex items-center text-[#4c616c] hover:text-[#00342d] transition-colors focus:outline-none">
                  <span className="material-symbols-outlined text-2xl">account_circle</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 border border-[#1b1c1a]/5 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50">
                  <span className="block px-4 py-2 text-sm text-[#4c616c]">
                    {t('Olá')}, <strong>{usuario.nome}</strong>
                  </span>
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-[#ba1a1a] hover:bg-[#ffdad6]/20 transition-colors"
                  >
                    {t('Sair')}
                  </button>
                </div>
              </div>
              <LanguageSwitcher />
            </div>
          </div>
          {/* Mobile tab navigation */}
          <div className="md:hidden flex gap-1 px-4 pb-2 overflow-x-auto items-center">
            <button
              onClick={() => setAbaAtiva('processos')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                abaAtiva === 'processos' ? 'bg-[#00342d] text-white' : 'bg-[#eae8e5] text-[#4c616c]'
              }`}
            >
              {t('Processos')}
            </button>
            <button
              onClick={() => { setAbaAtiva('atendimentos'); handoffsQuery.refetch(); }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                abaAtiva === 'atendimentos' ? 'bg-[#00342d] text-white' : 'bg-[#eae8e5] text-[#4c616c]'
              }`}
            >
              {t('Atendimentos')}
              {handoffs.filter(h => h.status !== 'resolvido').length > 0 && (
                <span className="bg-[#ba1a1a] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {handoffs.filter(h => h.status !== 'resolvido').length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setAbaAtiva('requisitos'); requisitosQuery.refetch(); }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                abaAtiva === 'requisitos' ? 'bg-[#00342d] text-white' : 'bg-[#eae8e5] text-[#4c616c]'
              }`}
            >
              {t('Requisitos')}
            </button>
            <div className="ml-auto shrink-0">
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* Canvas */}
        <div className="p-4 md:p-8 max-w-[1440px] mx-auto w-full flex-1">
          {/* Messages */}
          {erro && <AlertMessage tipo="erro" mensagem={erro} onFechar={() => setErro('')} />}
          {sucesso && <AlertMessage tipo="sucesso" mensagem={sucesso} onFechar={() => setSucesso('')} />}

          {/* ===================== PROCESSOS TAB ===================== */}
          {abaAtiva === 'processos' && (
            <>
              {/* Hero Stats */}
              <section className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="pt-1">
                  <p className="text-[#4c616c] max-w-md">{t('Acompanhe a evolução de cada jornada migratória com precisão institucional e excelência operacional.')}</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-[#f5f3f0] p-4 rounded-xl min-w-[140px]">
                    <p className="text-[10px] uppercase tracking-widest text-[#4c616c] mb-1">{t('Em Aberto')}</p>
                    <p className="font-serif text-3xl font-bold text-[#00342d]">{statsEmAberto}</p>
                  </div>
                  <div className="bg-[#00342d] text-white p-4 rounded-xl min-w-[140px]">
                    <p className="text-[10px] uppercase tracking-widest text-[#84d5c5] mb-1">{t('Aprovados')}</p>
                    <p className="font-serif text-3xl font-bold">{statsAprovados}%</p>
                  </div>
                </div>
              </section>

              {/* Filters & Search */}
              <section className="bg-white rounded-2xl p-4 md:p-6 mb-8 border border-stone-200/10 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 justify-between items-start lg:items-center">
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {FILTER_BUTTONS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFiltroStatus(f.key)}
                        className={`px-4 md:px-6 py-2 rounded-full text-sm transition-all ${
                          filtroStatus === f.key
                            ? 'bg-[#00342d] text-white'
                            : 'bg-[#eae8e5] text-[#4c616c] hover:bg-[#a0f2e1] hover:text-[#00342d]'
                        }`}
                      >
                        {t(f.label)}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full lg:w-96">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#707975]">search</span>
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[#f5f3f0] border-none rounded-xl focus:ring-2 focus:ring-[#00342d]/20 text-sm focus:outline-none"
                      placeholder={t('Nome do cliente ou protocolo...')}
                      type="text"
                    />
                  </div>
                </div>
              </section>

              {/* Process Table */}
              {carregando ? (
                <section className="bg-white rounded-2xl overflow-hidden border border-stone-200/10 shadow-sm">
                  <table className="w-full"><tbody>
                    {[0, 1, 2, 3, 4].map((i) => <ProcessoRowSkeleton key={i} />)}
                  </tbody></table>
                </section>
              ) : processosFiltrados.length === 0 ? (
                <section className="bg-white rounded-2xl border border-stone-200/10 shadow-sm p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#f5f3f0] flex items-center justify-center mx-auto mb-4 text-[#4c616c]">
                    <span className="material-symbols-outlined text-[36px]">folder_open</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#1b1c1a] mb-2 font-serif">
                    {busca || filtroStatus !== 'todos' ? t('Nenhum processo encontrado') : t('Nenhum processo cadastrado')}
                  </h3>
                  <p className="text-[#4c616c]">
                    {busca || filtroStatus !== 'todos'
                      ? t('Tente ajustar os filtros ou o termo de busca.')
                      : t('Ainda não há processos cadastrados no sistema.')}
                  </p>
                </section>
              ) : (
                <section className="bg-white rounded-2xl overflow-hidden border border-stone-200/10 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#f5f3f0]">
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c]">{t('# ID')}</th>
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c]">{t('Cliente')}</th>
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c] hidden md:table-cell">{t('Tipo de Visto')}</th>
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c] hidden lg:table-cell">{t('País')}</th>
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c] hidden lg:table-cell">{t('Data de Criação')}</th>
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c]">{t('Status')}</th>
                          <th className="px-4 md:px-6 py-4 text-[11px] uppercase tracking-widest text-[#4c616c] text-right">{t('Ação')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {processosFiltrados.map((p) => (
                          <tr key={p.id} className="hover:bg-[#f5f3f0] transition-colors group cursor-pointer" onClick={() => toggleProcesso(p.id)}>
                            <td className="px-4 md:px-6 py-5 text-sm font-medium text-[#3d2a00]">#{p.id}</td>
                            <td className="px-4 md:px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#eae8e5] flex items-center justify-center text-[#4c616c] shrink-0">
                                  <span className="material-symbols-outlined text-[16px]">person</span>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[#1b1c1a] font-semibold block truncate">{p.usuario_nome}</span>
                                  {p.usuario_email && (
                                    <span className="text-xs text-[#707975] hidden sm:block truncate">{p.usuario_email}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 md:px-6 py-5 text-sm text-[#4c616c] hidden md:table-cell">{t(TIPO_LABELS[p.tipo] || p.tipo)}</td>
                            <td className="px-4 md:px-6 py-5 hidden lg:table-cell">
                              {p.pais_destino && (
                                <div className="flex items-center gap-2">
                                  {getCountryFlag(p.pais_destino) ? (
                                    <span className="text-base leading-none" aria-hidden="true">{getCountryFlag(p.pais_destino)}</span>
                                  ) : (
                                    <span className="material-symbols-outlined text-sm text-[#00342d]">flag</span>
                                  )}
                                  <span className="text-sm text-[#4c616c]">{p.pais_destino}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 md:px-6 py-5 text-sm text-[#4c616c] hidden lg:table-cell">{formatDateShortPtBr(p.criado_em)}</td>
                            <td className="px-4 md:px-6 py-5">
                              <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight ${STATUS_LABELS[p.status]?.cor || 'bg-[#e4e2df] text-[#3f4945]'}`}>
                                {t(STATUS_LABELS[p.status]?.label || p.status)}
                              </span>
                            </td>
                            <td className="px-4 md:px-6 py-5 text-right">
                              <button className="text-[#00342d] font-bold text-sm hover:underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                {processoExpandido === p.id ? t('Fechar') : t('Ver Detalhes')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination info */}
                  <div className="px-4 md:px-6 py-4 flex items-center justify-between bg-[#f5f3f0] border-t border-stone-100">
                    <p className="text-xs text-[#4c616c] uppercase tracking-widest">
                      {t('Exibindo')} {processosFiltrados.length} {t('de')} {processos.length} {t('processos')}
                    </p>
                  </div>
                </section>
              )}

              {/* Expanded Process Panel (below table) */}
              {processoExpandido && processosFiltrados.some((p) => p.id === processoExpandido) && (() => {
                const p = processos.find((p) => p.id === processoExpandido)!;
                return (
                  <section className="mt-6 bg-white rounded-2xl overflow-hidden border border-stone-200/10 shadow-sm">
                    {/* Panel Header */}
                    <div className="bg-[#f5f3f0] px-4 md:px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#eae8e5] flex items-center justify-center text-[#4c616c]">
                          <span className="material-symbols-outlined text-[20px]">person</span>
                        </div>
                        <div>
                          <h3 className="font-serif font-bold text-[#00342d] text-lg">{t('Processo')} #{p.id} — {p.usuario_nome}</h3>
                          <p className="text-sm text-[#4c616c]">
                            {t(TIPO_LABELS[p.tipo] || p.tipo)}
                            {p.pais_destino && <> &middot; {p.pais_destino}</>}
                            &middot; {formatDateShortPtBr(p.criado_em)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleProcesso(p.id)}
                        className="p-2 rounded-lg hover:bg-stone-200 transition-colors text-[#707975]"
                      >
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>

                    <div className="p-4 md:p-6 space-y-6">
                      {/* Process Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                        {p.nome_completo && (
                          <div className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-[#4c616c] font-semibold">{t('Nome Completo')}</p>
                            <p className="text-sm text-[#1b1c1a] font-medium mt-0.5">{p.nome_completo}</p>
                          </div>
                        )}
                        {p.data_nascimento && (
                          <div className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-[#4c616c] font-semibold">{t('Nascimento')}</p>
                            <p className="text-sm text-[#1b1c1a] font-medium mt-0.5">{formatDateOnlyPtBr(p.data_nascimento)}</p>
                          </div>
                        )}
                        {p.passaporte && (
                          <div className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-[#4c616c] font-semibold">{t('Passaporte')}</p>
                            <p className="text-sm text-[#1b1c1a] font-medium mt-0.5">{p.passaporte}</p>
                          </div>
                        )}
                        {p.data_expiracao_passaporte && (
                          <div className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                            <p className="text-[10px] uppercase tracking-widest text-[#4c616c] font-semibold">{t('Exp. Passaporte')}</p>
                            <p className="text-sm text-[#1b1c1a] font-medium mt-0.5">{formatDateOnlyPtBr(p.data_expiracao_passaporte)}</p>
                          </div>
                        )}
                        <div className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#4c616c] font-semibold">{t('Documentos')}</p>
                          <p className="text-sm text-[#1b1c1a] font-medium mt-0.5">{p.total_documentos ?? 0} {t('arquivos')}</p>
                        </div>
                      </div>

                      {p.descricao && (
                        <div className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#4c616c] font-semibold">{t('Observações do Cliente')}</p>
                          <p className="text-sm text-[#1b1c1a] mt-1">{p.descricao}</p>
                        </div>
                      )}

                      {/* Copiloto de Prontidão */}
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          {!['aprovado', 'rejeitado', 'cancelado'].includes(p.status) && (
                            <button
                              onClick={() => handleAnalisarCaso(p.id)}
                              disabled={analisandoCaso !== null}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#00342d] text-white hover:bg-[#004d43] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {analisandoCaso === p.id ? (
                                <>
                                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                  {t('Analisando caso...')}
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                                  {t('Analisar Caso com IA')}
                                </>
                              )}
                            </button>
                          )}
                          {analises[p.id] && !analisandoCaso && (
                            <button
                              onClick={() => setMostrarAnalise(mostrarAnalise === p.id ? null : p.id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-[#4c616c] hover:bg-[#f5f3f0] border border-[#bfc9c4] transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">assessment</span>
                              {mostrarAnalise === p.id ? t('Ocultar') : t('Ver')} {t('Relatório')} ({analises[p.id].pontuacao}/100)
                            </button>
                          )}
                        </div>

                        {analisandoCaso === p.id && (
                          <div className="bg-[#a0f2e1]/30 border border-[#00342d]/20 rounded-xl p-4 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#a0f2e1] flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#00342d] text-[18px] animate-spin">progress_activity</span>
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#00342d]">{t('Agente IA analisando o caso...')}</p>
                                <p className="text-xs text-[#004d43]">{t('Verificando documentos, validade, consistência. Isso pode levar até 30 segundos.')}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {mostrarAnalise === p.id && analises[p.id] && (
                          <div className="bg-white border border-[#bfc9c4] rounded-xl overflow-hidden mb-3">
                            {/* Score Header */}
                            <div className={`px-5 py-4 flex items-center justify-between ${
                              analises[p.id].pontuacao >= 80 ? 'bg-emerald-50' :
                              analises[p.id].pontuacao >= 50 ? 'bg-[#ffdea5]/30' : 'bg-[#ffdad6]/30'
                            }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white ${
                                  analises[p.id].pontuacao >= 80 ? 'bg-emerald-600' :
                                  analises[p.id].pontuacao >= 50 ? 'bg-[#593f00]' : 'bg-[#ba1a1a]'
                                }`}>
                                  {analises[p.id].pontuacao}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-[#1b1c1a]">{t('Pontuação de Prontidão')}</p>
                                  <p className="text-xs text-[#4c616c]">
                                    {analises[p.id].pontuacao >= 80 ? t('Caso pronto para submissão') :
                                     analises[p.id].pontuacao >= 50 ? t('Caso precisa de ajustes') : t('Caso com pendências críticas')}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-[#707975]">
                                {new Date(analises[p.id].criado_em).toLocaleString('pt-BR')}
                              </span>
                            </div>

                            {/* AI Summary */}
                            <div className="px-5 py-3 border-b border-[#bfc9c4]/50">
                              <p className="text-xs uppercase tracking-wider text-[#707975] font-semibold mb-1">{t('Resumo da IA')}</p>
                              <p className="text-sm text-[#1b1c1a]">{analises[p.id].resumo_ia}</p>
                            </div>

                            {/* Checklist */}
                            <div className="px-5 py-3 border-b border-[#bfc9c4]/50">
                              <p className="text-xs uppercase tracking-wider text-[#707975] font-semibold mb-2">{t('Verificações')}</p>
                              <div className="space-y-1.5">
                                {analises[p.id].itens.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className={`material-symbols-outlined text-[16px] mt-0.5 shrink-0 ${
                                      item.status === 'aprovado' ? 'text-emerald-600' :
                                      item.status === 'reprovado' ? 'text-[#ba1a1a]' : 'text-[#593f00]'
                                    }`}>
                                      {item.status === 'aprovado' ? 'check_circle' :
                                       item.status === 'reprovado' ? 'cancel' : 'warning'}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-sm text-[#1b1c1a]">{item.descricao}</p>
                                      {item.detalhes && (
                                        <p className="text-xs text-[#707975]">{item.detalhes}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Missing Docs */}
                            {analises[p.id].documentos_faltantes.length > 0 && (
                              <div className="px-5 py-3 border-b border-[#bfc9c4]/50 bg-[#ffdad6]/20">
                                <p className="text-xs uppercase tracking-wider text-[#ba1a1a] font-semibold mb-1">{t('Documentos Faltantes')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {analises[p.id].documentos_faltantes.map((doc, idx) => (
                                    <span key={idx} className="text-xs bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded-full">
                                      {t(TIPO_DOCUMENTO_LABELS[doc] || doc)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Alerts */}
                            {analises[p.id].alertas.length > 0 && (
                              <div className="px-5 py-3">
                                <p className="text-xs uppercase tracking-wider text-[#593f00] font-semibold mb-1">{t('Alertas')}</p>
                                {analises[p.id].alertas.map((alerta, idx) => (
                                  <div key={idx} className="flex items-start gap-2 mb-1">
                                    <span className="material-symbols-outlined text-[14px] text-[#593f00] mt-0.5">warning</span>
                                    <p className="text-xs text-[#4c616c]">{alerta}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timeline */}
                      <div>
                        <h4 className="text-sm font-bold text-[#1b1c1a] flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-[18px] text-[#00342d]">timeline</span>
                          {t('Linha do Tempo')}
                        </h4>
                        <ProcessoTimeline
                          statusAtual={p.status}
                          criadoEm={p.criado_em}
                          historico={(processoExpandido === p.id ? historicoQuery.data?.historico : undefined) || []}
                          carregando={processoExpandido === p.id && historicoQuery.isLoading}
                        />
                      </div>

                      {/* Documentos */}
                      <div className="border-t border-[#bfc9c4]/30 pt-5">
                        <h4 className="text-sm font-bold text-[#1b1c1a] flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-[18px] text-[#00342d]">attach_file</span>
                          {t('Documentos')} ({((processoExpandido === p.id ? documentosQuery.data?.documentos : undefined) || []).length})
                        </h4>

                        {processoExpandido === p.id && documentosQuery.isLoading ? (
                          <p className="text-xs text-[#707975] py-2">{t('Carregando documentos...')}</p>
                        ) : ((processoExpandido === p.id ? documentosQuery.data?.documentos : undefined) || []).length === 0 ? (
                          <p className="text-xs text-[#707975] py-2">{t('Nenhum documento enviado pelo cliente.')}</p>
                        ) : (
                          <div className="space-y-2">
                            {((processoExpandido === p.id ? documentosQuery.data?.documentos : undefined) || []).map((doc) => {
                              const statusDoc = STATUS_DOC_BADGES[doc.status] || STATUS_DOC_BADGES.pendente_revisao;
                              return (
                                <div key={doc.id} className="bg-[#f5f3f0] rounded-xl px-4 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span className="material-symbols-outlined text-[20px] text-[#00342d] shrink-0">
                                        {doc.tipo_arquivo?.includes('pdf') ? 'picture_as_pdf' : doc.tipo_arquivo?.includes('image') ? 'image' : 'description'}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-[#1b1c1a] truncate">{doc.nome_original}</p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                          <span className="inline-flex items-center bg-[#cfe6f2] text-[#071e27] px-1.5 py-0.5 rounded text-xs font-medium">
                                            {t(TIPO_DOCUMENTO_LABELS[doc.tipo_documento] || doc.tipo_documento)}
                                          </span>
                                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${statusDoc.cor}`}>
                                            <span className="material-symbols-outlined text-[12px]">{statusDoc.icone}</span>
                                            {t(statusDoc.label)}
                                          </span>
                                          <span className="text-xs text-[#707975]">
                                            {formatarTamanho(doc.tamanho)} &middot; {new Date(doc.criado_em).toLocaleDateString('pt-BR')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                      <button
                                        onClick={() => handleDownload(p.id, doc.id, doc.nome_original)}
                                        className="p-1.5 rounded-lg text-[#707975] hover:text-[#00342d] hover:bg-[#a0f2e1]/30 transition-all"
                                        title={t('Baixar documento')}
                                      >
                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                      </button>
                                      {doc.status === 'pendente_revisao' && (
                                        <>
                                          {['passaporte', 'foto'].includes(doc.tipo_documento) && (
                                            <button
                                              onClick={() => handleAprovarComIA(p.id, doc.id)}
                                              disabled={analisandoIaDocId === doc.id}
                                              className="p-1.5 rounded-lg text-[#707975] hover:text-[#004d43] hover:bg-[#a0f2e1]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                              title={t('Aprovar com IA')}
                                            >
                                              <span className={`material-symbols-outlined text-[18px] ${analisandoIaDocId === doc.id ? 'animate-spin' : ''}`}>
                                                {analisandoIaDocId === doc.id ? 'progress_activity' : 'smart_toy'}
                                              </span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => { setAvaliacaoAberta({ docId: doc.id, processoId: p.id, acao: 'aprovado' }); setFeedbackAvaliacao(''); }}
                                            className="p-1.5 rounded-lg text-[#707975] hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                                            title={t('Aprovar manualmente')}
                                          >
                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                          </button>
                                          <button
                                            onClick={() => { setAvaliacaoAberta({ docId: doc.id, processoId: p.id, acao: 'rejeitado' }); setFeedbackAvaliacao(''); }}
                                            className="p-1.5 rounded-lg text-[#707975] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/50 transition-all"
                                            title={t('Rejeitar documento')}
                                          >
                                            <span className="material-symbols-outlined text-[18px]">cancel</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {doc.feedback && (
                                    <div className={`mt-2 ml-8 p-2 rounded-lg ${doc.status === 'rejeitado' ? 'bg-[#ffdad6]/50 border border-[#ba1a1a]/10' : 'bg-emerald-50 border border-emerald-200'}`}>
                                      <p className={`text-xs ${doc.status === 'rejeitado' ? 'text-[#93000a]' : 'text-emerald-700'}`}>
                                        <strong>{t('Feedback')}:</strong> {doc.feedback}
                                      </p>
                                    </div>
                                  )}
                                  {/* Inline avaliação */}
                                  {avaliacaoAberta?.docId === doc.id && avaliacaoAberta?.processoId === p.id && (
                                    <div className="mt-3 ml-8 p-3 bg-white border border-[#bfc9c4] rounded-xl">
                                      <p className="text-xs font-semibold text-[#4c616c] mb-2">
                                        {avaliacaoAberta.acao === 'aprovado' ? t('Aprovar manualmente') : t('Rejeitar documento')}
                                      </p>
                                      <textarea
                                        value={feedbackAvaliacao}
                                        onChange={(e) => setFeedbackAvaliacao(e.target.value)}
                                        placeholder={avaliacaoAberta.acao === 'rejeitado' ? t('Motivo da rejeição (recomendado)...') : t('Comentário (opcional)...')}
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-lg border border-[#bfc9c4] text-xs text-[#1b1c1a] focus:border-[#00342d] outline-none resize-none mb-2"
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={handleAvaliarDocumento}
                                          disabled={enviandoAvaliacao}
                                          className={`text-xs font-bold px-4 py-1.5 rounded-lg text-white transition-all ${
                                            avaliacaoAberta.acao === 'aprovado'
                                              ? 'bg-emerald-700 hover:bg-emerald-800'
                                              : 'bg-[#ba1a1a] hover:bg-[#93000a]'
                                          } disabled:opacity-50`}
                                        >
                                          {enviandoAvaliacao ? t('Salvando...') : avaliacaoAberta.acao === 'aprovado' ? t('Confirmar Aprovação') : t('Confirmar Rejeição')}
                                        </button>
                                        <button
                                          onClick={() => setAvaliacaoAberta(null)}
                                          className="text-xs text-[#4c616c] hover:text-[#1b1c1a] px-3 py-1.5"
                                        >
                                          {t('Cancelar')}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Solicitações de Documentos */}
                      <div className="border-t border-[#bfc9c4]/30 pt-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-[#1b1c1a] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-[#593f00]">assignment</span>
                            {t('Solicitações de Documentos')}
                          </h4>
                          {!['aprovado', 'rejeitado', 'cancelado'].includes(p.status) && (
                          <button
                            onClick={() => {
                              setMostrarSolicitarDocs(mostrarSolicitarDocs === p.id ? null : p.id);
                              setItensSolicitacao([]);
                              setNovoTipoSolicitacao('');
                              setNovaDescSolicitacao('');
                            }}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#593f00] text-white hover:bg-[#3d2a00] transition-all"
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            {t('Solicitar Documentos')}
                          </button>
                          )}
                        </div>

                        {/* Lista de solicitações existentes */}
                        {((processoExpandido === p.id ? solicitacoesQuery.data?.solicitacoes : undefined) || []).length > 0 && (
                          <div className="space-y-2 mb-4">
                            {((processoExpandido === p.id ? solicitacoesQuery.data?.solicitacoes : undefined) || []).map((sol) => {
                              const solCor =
                                sol.status === 'pendente' ? 'bg-[#ffdea5] text-[#3d2a00]' :
                                sol.status === 'enviado' ? 'bg-[#cfe6f2] text-[#071e27]' :
                                sol.status === 'aprovado' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#ffdad6] text-[#93000a]';
                              const solLabel =
                                sol.status === 'pendente' ? t('Aguardando Envio') :
                                sol.status === 'enviado' ? t('Enviado - Aguardando Revisão') :
                                sol.status === 'aprovado' ? t('Aprovado') : t('Rejeitado');
                              return (
                                <div key={sol.id} className="bg-[#f5f3f0] rounded-xl px-4 py-2.5 flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-[#1b1c1a]">{t(TIPO_DOCUMENTO_LABELS[sol.tipo_documento] || sol.tipo_documento)}</span>
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${solCor}`}>{solLabel}</span>
                                      {sol.obrigatoria && <span className="text-xs text-[#ba1a1a] font-medium">{t('Obrigatório')}</span>}
                                    </div>
                                    {sol.descricao && <p className="text-xs text-[#707975] mt-0.5">{sol.descricao}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Formulário de nova solicitação */}
                        {mostrarSolicitarDocs === p.id && (
                          <div className="bg-white border border-[#bfc9c4] rounded-xl p-4">
                            <p className="text-xs font-semibold text-[#4c616c] mb-3">{t('Adicionar documentos à solicitação')}</p>

                            <div className="flex flex-col sm:flex-row items-end gap-2 mb-3">
                              <div className="flex-1 w-full">
                                <select
                                  value={novoTipoSolicitacao}
                                  onChange={(e) => setNovoTipoSolicitacao(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-[#bfc9c4] text-sm text-[#1b1c1a] bg-white focus:border-[#00342d] outline-none"
                                >
                                  <option value="">{t('Tipo do documento')}</option>
                                  {TIPOS_DOCUMENTO_OPTIONS.map((td) => (
                                    <option key={td.value} value={td.value}>{t(td.label)}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex-1 w-full">
                                <input
                                  type="text"
                                  value={novaDescSolicitacao}
                                  onChange={(e) => setNovaDescSolicitacao(e.target.value)}
                                  placeholder={t('Descrição (opcional)')}
                                  className="w-full px-3 py-2 rounded-lg border border-[#bfc9c4] text-sm text-[#1b1c1a] focus:border-[#00342d] outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!novoTipoSolicitacao) return;
                                  setItensSolicitacao((prev) => [...prev, { tipo_documento: novoTipoSolicitacao, descricao: novaDescSolicitacao, obrigatoria: true }]);
                                  setNovoTipoSolicitacao('');
                                  setNovaDescSolicitacao('');
                                }}
                                className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-[#00342d] text-white hover:bg-[#004d43] transition-all shrink-0"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                {t('Adicionar')}
                              </button>
                            </div>

                            {/* Itens adicionados */}
                            {itensSolicitacao.length > 0 && (
                              <div className="space-y-1 mb-3">
                                {itensSolicitacao.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-[#f5f3f0] rounded-lg px-3 py-2">
                                    <div>
                                      <span className="text-sm font-medium text-[#1b1c1a]">{t(TIPO_DOCUMENTO_LABELS[item.tipo_documento] || item.tipo_documento)}</span>
                                      {item.descricao && <span className="text-xs text-[#707975] ml-2">{item.descricao}</span>}
                                    </div>
                                    <button
                                      onClick={() => setItensSolicitacao((prev) => prev.filter((_, i) => i !== idx))}
                                      className="text-[#707975] hover:text-[#ba1a1a] transition-colors"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEnviarSolicitacoes(p.id)}
                                disabled={enviandoSolicitacao || itensSolicitacao.length === 0}
                                className="flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg bg-[#593f00] text-white hover:bg-[#3d2a00] disabled:opacity-40 transition-all"
                              >
                                {enviandoSolicitacao ? t('Enviando...') : `${t('Enviar Solicitação')} (${itensSolicitacao.length})`}
                              </button>
                              <button
                                onClick={() => { setMostrarSolicitarDocs(null); setItensSolicitacao([]); setNovoTipoSolicitacao(''); setNovaDescSolicitacao(''); }}
                                className="text-xs text-[#4c616c] hover:text-[#1b1c1a] px-3 py-2"
                              >
                                {t('Cancelar')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Update Status Form */}
                      <div className="border-t border-[#bfc9c4]/30 pt-5">
                        <h4 className="text-sm font-bold text-[#1b1c1a] flex items-center gap-2 mb-4">
                          <span className="material-symbols-outlined text-[18px] text-[#4c616c]">swap_horiz</span>
                          {t('Atualizar Status')}
                        </h4>

                        {processoExpandido === p.id && transicoesQuery.isLoading ? (
                          <div className="flex items-center gap-2 text-sm text-[#707975] py-2">
                            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                            {t('Carregando transições...')}
                          </div>
                        ) : ((processoExpandido === p.id ? transicoesQuery.data?.transicoes_permitidas : undefined) || []).length === 0 ? (
                          <div className="flex items-center gap-2 text-sm text-[#707975] py-2 bg-[#f5f3f0] rounded-xl px-4 border border-[#bfc9c4]/30">
                            <span className="material-symbols-outlined text-[18px]">lock</span>
                            {t('Este processo está em estado terminal')} ({t(STATUS_LABELS[p.status]?.label || p.status)}). {t('Não há transições disponíveis.')}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Status Selection */}
                            <div>
                              <label className="block text-xs font-semibold text-[#707975] mb-2">
                                {t('Novo Status')} <span className="text-[#ba1a1a]">*</span>
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {((processoExpandido === p.id ? transicoesQuery.data?.transicoes_permitidas : undefined) || []).map((statusOpt) => (
                                  <button
                                    key={statusOpt}
                                    type="button"
                                    onClick={() => setNovoStatus((prev) => ({ ...prev, [p.id]: statusOpt }))}
                                    className={`text-xs font-semibold px-4 py-2 rounded-xl border-2 transition-all ${
                                      novoStatus[p.id] === statusOpt
                                        ? statusOpt === 'aprovado'
                                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                                          : statusOpt === 'rejeitado'
                                          ? 'border-[#ba1a1a] bg-[#ffdad6]/30 text-[#93000a]'
                                          : statusOpt === 'cancelado'
                                          ? 'border-[#707975] bg-[#e4e2df] text-[#3f4945]'
                                          : 'border-[#00342d] bg-[#a0f2e1]/30 text-[#00342d]'
                                        : 'border-[#bfc9c4] bg-white text-[#4c616c] hover:border-[#707975]'
                                    }`}
                                  >
                                    {t(STATUS_LABELS[statusOpt]?.label || statusOpt)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Observation */}
                            <div>
                              <label className="block text-xs font-semibold text-[#707975] mb-1.5">
                                {t('Observação')} <span className="text-[#707975] font-normal">{t('(opcional — será incluída no e-mail ao cliente)')}</span>
                              </label>
                              <textarea
                                value={observacao[p.id] || ''}
                                onChange={(e) => setObservacao((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder={t('Adicione uma nota ou motivo da mudança de status...')}
                                rows={2}
                                className="w-full px-4 py-2.5 rounded-xl border border-[#bfc9c4] focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/20 outline-none transition-all text-sm text-[#1b1c1a] placeholder:text-[#707975] resize-none bg-white"
                              />
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end">
                              <button
                                disabled={!novoStatus[p.id] || atualizando === p.id}
                                onClick={() => pedirConfirmacao(p.id, p.usuario_nome)}
                                className="flex items-center gap-2 h-10 px-6 rounded-xl bg-[#00342d] text-white text-sm font-bold shadow-lg shadow-[#00342d]/20 hover:bg-[#004d43] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                {atualizando === p.id ? (
                                  <>
                                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                    {t('Atualizando...')}
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-[18px]">save</span>
                                    {t('Atualizar Status')}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })()}
            </>
          )}

          {/* ===================== ATENDIMENTOS TAB ===================== */}
          {abaAtiva === 'atendimentos' && (
            handoffs.length === 0 ? (
              <div className="bg-white border border-stone-200/10 shadow-sm rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#f5f3f0] flex items-center justify-center mx-auto mb-4 text-[#4c616c]">
                  <span className="material-symbols-outlined text-[36px]">support_agent</span>
                </div>
                <h3 className="text-xl font-bold text-[#1b1c1a] mb-2 font-serif">{t('Nenhum atendimento')}</h3>
                <p className="text-[#4c616c]">{t('Não há solicitações de atendimento no momento.')}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200/10 shadow-sm overflow-hidden flex" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
                {/* Sidebar: Client List */}
                <section className={`w-full max-w-sm border-r border-[#bfc9c4]/20 flex flex-col bg-white ${handoffAberto ? 'hidden md:flex' : 'flex'}`}>
                  {/* Search */}
                  <div className="p-4 border-b border-[#bfc9c4]/10">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#707975] text-sm">search</span>
                      <input
                        value={buscaHandoff}
                        onChange={(e) => setBuscaHandoff(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#f5f3f0] border-none rounded-lg text-sm focus:ring-1 focus:ring-[#00342d]/20 focus:outline-none placeholder:text-[#bfc9c4]"
                        placeholder={t('Buscar clientes...')}
                        type="text"
                      />
                    </div>
                  </div>
                  {/* Client List */}
                  <div className="flex-1 overflow-y-auto">
                    {handoffsFiltrados.map((h) => {
                      const isActive = handoffAberto === h.id;
                      const isResolvido = h.status === 'resolvido';
                      const initials = (h.nome_usuario || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                      const timeStr = (() => {
                        const d = new Date(h.criado_em);
                        const now = new Date();
                        const diffMs = now.getTime() - d.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        if (diffMins < 1) return t('AGORA');
                        if (diffMins < 60) return `${diffMins}min`;
                        const diffHrs = Math.floor(diffMins / 60);
                        if (diffHrs < 24) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        if (diffHrs < 48) return t('ONTEM');
                        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      })();

                      return (
                        <div
                          key={h.id}
                          onClick={() => abrirHandoff(h.id)}
                          className={`p-4 flex gap-3 cursor-pointer transition-colors border-l-4 ${
                            isActive
                              ? 'border-[#00342d] bg-[#eae8e5]/40'
                              : isResolvido
                              ? 'border-transparent opacity-60 hover:opacity-80 hover:bg-[#efeeeb]'
                              : 'border-transparent hover:bg-[#efeeeb]'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${
                              isResolvido
                                ? 'bg-[#e4e2df] text-[#707975]'
                                : 'bg-[#cfe6f2] text-[#071e27]'
                            }`}>
                              {initials}
                            </div>
                            {h.status === 'em_atendimento' && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                            )}
                            {h.status === 'pendente' && (
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#ffdea5] border-2 border-white rounded-full"></span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-0.5">
                              <h3 className="text-sm font-bold text-[#1b1c1a] truncate">{h.nome_usuario || t('Usuário')}</h3>
                              <span className="text-[10px] text-[#707975] font-medium ml-2 shrink-0">{timeStr}</span>
                            </div>
                            <p className="text-xs text-[#707975] truncate">
                              {h.motivo || h.email_usuario || `Chat ID: ${h.telegram_chat_id}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              h.canal === 'web' ? 'bg-[#cfe6f2] text-[#071e27]' : 'bg-[#a0f2e1] text-[#00201b]'
                            }`}>
                              {h.canal === 'web' ? t('Web') : t('TG')}
                            </span>
                            {h.status === 'pendente' && (
                              <span className="bg-[#00342d] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">!</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Main Chat Area */}
                <section className={`flex-1 flex flex-col bg-[#fbf9f6] ${!handoffAberto ? 'hidden md:flex' : 'flex'}`}>
                  {!handoffAberto ? (
                    /* No chat selected placeholder */
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-20 h-20 rounded-2xl bg-[#f5f3f0] flex items-center justify-center mb-4 text-[#bfc9c4]">
                        <span className="material-symbols-outlined text-[40px]">forum</span>
                      </div>
                      <h3 className="text-lg font-bold text-[#1b1c1a] font-serif mb-1">{t('Selecione um atendimento')}</h3>
                      <p className="text-sm text-[#707975] max-w-xs">{t('Escolha um cliente na lista ao lado para iniciar ou continuar uma conversa.')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Chat Header */}
                      <header className="h-20 px-4 md:px-8 flex items-center justify-between border-b border-[#bfc9c4]/10 bg-[#fbf9f6]/80 backdrop-blur-md shrink-0">
                        <div className="flex items-center gap-4">
                          {/* Mobile back button */}
                          <button onClick={() => setHandoffAberto(null)} className="md:hidden text-[#707975] hover:text-[#1b1c1a] transition-colors">
                            <span className="material-symbols-outlined">arrow_back</span>
                          </button>
                          <div className="w-10 h-10 rounded-full border-2 border-[#00342d]/10 bg-[#cfe6f2] flex items-center justify-center text-[#071e27] font-bold text-sm">
                            {(handoffAtivoData?.nome_usuario || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h2 className="font-bold text-[#1b1c1a]">{handoffAtivoData?.nome_usuario || t('Usuário')}</h2>
                            <div className="flex items-center gap-1.5">
                              {handoffAtivoData?.status === 'em_atendimento' && (
                                <>
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{t('Em atendimento')}</span>
                                </>
                              )}
                              {handoffAtivoData?.status === 'pendente' && (
                                <>
                                  <span className="w-1.5 h-1.5 bg-[#593f00] rounded-full"></span>
                                  <span className="text-[10px] font-bold text-[#593f00] uppercase tracking-widest">{t('Pendente')}</span>
                                </>
                              )}
                              {handoffAtivoData?.email_usuario && (
                                <span className="text-[10px] text-[#707975] ml-2">{handoffAtivoData.email_usuario}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {handoffAtivoData?.status === 'resolvido' ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#707975] uppercase tracking-wider">
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              {t('Encerrado')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEncerrarHandoff(handoffAberto)}
                              disabled={handoffEncerrando}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
                              <span className="hidden sm:inline">{handoffEncerrando ? t('Encerrando...') : t('Encerrar Atendimento')}</span>
                            </button>
                          )}
                        </div>
                      </header>

                      {/* Messages Area */}
                      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 flex flex-col">
                        {handoffCarregando ? (
                          <p className="self-center text-[#707975] text-sm py-8">{t('Carregando mensagens...')}</p>
                        ) : handoffMensagens.length === 0 ? (
                          <div className="self-center text-center py-8">
                            <p className="text-[#707975] text-sm">{t('Nenhuma mensagem ainda.')}</p>
                            <p className="text-[#bfc9c4] text-xs mt-1">{t('Envie a primeira mensagem para iniciar o atendimento.')}</p>
                          </div>
                        ) : (
                          <>
                            {/* Date Separator */}
                            <div className="self-center">
                              <span className="text-[10px] font-bold text-[#707975] uppercase tracking-[0.2em] bg-[#eae8e5] px-4 py-1 rounded-full">
                                {new Date(handoffMensagens[0].criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                              </span>
                            </div>
                            {handoffMensagens.map((msg) => {
                              const isSent = msg.remetente_tipo === 'funcionario';
                              return (
                                <div key={msg.id} className={`flex items-end gap-3 max-w-[70%] ${isSent ? 'self-end flex-row-reverse' : ''}`}>
                                  {/* Avatar */}
                                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                                    isSent ? 'bg-[#00342d]' : 'bg-[#eae8e5]'
                                  }`}>
                                    <span className={`material-symbols-outlined text-sm ${isSent ? 'text-white' : 'text-[#707975]'}`}>
                                      {isSent ? 'support_agent' : 'person'}
                                    </span>
                                  </div>
                                  {/* Bubble */}
                                  <div className={`flex flex-col gap-1 ${isSent ? 'items-end' : ''}`}>
                                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                      isSent
                                        ? 'bg-[#00342d] text-white rounded-br-none'
                                        : 'bg-[#e4e2df] text-[#1b1c1a] rounded-bl-none'
                                    }`} style={{ boxShadow: '0 4px 32px rgba(27, 28, 26, 0.04)' }}>
                                      <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 ${isSent ? 'mr-1' : 'ml-1'}`}>
                                      <span className="text-[10px] text-[#707975]">
                                        {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isSent && (
                                        <span className="material-symbols-outlined text-[12px] text-[#00342d]" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Input Area */}
                      {handoffAtivoData?.status !== 'resolvido' && <footer className="p-4 md:p-6 bg-white border-t border-[#bfc9c4]/10 shrink-0">
                        <form onSubmit={handleEnviarMsgHandoff} className="max-w-4xl mx-auto flex items-end gap-3 bg-[#f5f3f0] p-2 rounded-2xl border border-[#bfc9c4]/20 focus-within:border-[#00342d]/30 focus-within:bg-[#efeeeb] transition-all">
                          <input
                            type="text"
                            value={handoffMsgInput}
                            onChange={(e) => setHandoffMsgInput(e.target.value)}
                            placeholder={t('Escreva sua mensagem aqui...')}
                            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm py-3 px-2 min-h-[44px] placeholder:text-[#bfc9c4]"
                          />
                          <button
                            type="submit"
                            disabled={handoffEnviando || !handoffMsgInput.trim()}
                            className="bg-[#00342d] text-white w-10 h-10 flex items-center justify-center rounded-xl shadow-lg shadow-[#00342d]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shrink-0"
                          >
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                          </button>
                        </form>
                      </footer>}
                    </>
                  )}
                </section>
              </div>
            )
          )}

          {/* ===================== REQUISITOS TAB ===================== */}
          {abaAtiva === 'requisitos' && (
            <div>
              {/* Header & Action */}
              <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-12 gap-6">
                <div className="space-y-2">
                  <p className="text-[#4c616c] max-w-md text-sm leading-relaxed">
                    {t('Gerencie a documentação institucional e critérios mandatórios para cada jurisdição e modalidade de visto global.')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setNovoRequisito(true);
                    setEditandoRequisito(null);
                    setFormRequisito({ tipo_visto: '', pais_destino: '', documentos_obrigatorios: ['passaporte', 'foto'], validade_minima_passaporte_meses: 6, ativo: true });
                  }}
                  className="bg-[#00342d] text-white px-6 py-3 rounded-md flex items-center gap-2 hover:bg-[#004d43] transition-all duration-300 shadow-xl shadow-[#00342d]/5 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined">add</span>
                  <span className="font-bold text-sm tracking-wide">{t('Novo Requisito')}</span>
                </button>
              </div>

              {/* Bento Layout: Metrics & Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {/* Metric Card */}
                <div className="md:col-span-1 bg-white p-6 rounded-xl border border-[#bfc9c4]/10 shadow-sm flex flex-col justify-between h-40">
                  <span className="text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Total de Regras')}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-serif font-extrabold text-[#00342d]">{requisitosAtivos}</span>
                    <span className="text-xs text-[#4c616c] mb-1">{t('ativos')}</span>
                  </div>
                  <div className="h-1 w-full bg-[#efeeeb] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00342d] rounded-full transition-all"
                      style={{ width: requisitos.length > 0 ? `${(requisitosAtivos / requisitos.length) * 100}%` : '0%' }}
                    ></div>
                  </div>
                </div>

                {/* Filters Bar */}
                <div className="md:col-span-3 bg-[#f5f3f0] p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-x-auto">
                  <div className="flex items-center gap-4">
                    <label className="text-[11px] uppercase tracking-widest text-[#4c616c] font-bold whitespace-nowrap">{t('Filtrar por Tipo:')}</label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setFiltroTipoRequisito('todos')}
                        className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                          filtroTipoRequisito === 'todos'
                            ? 'bg-[#00342d] text-white'
                            : 'bg-[#eae8e5] text-[#4c616c] hover:bg-[#e4e2df]'
                        }`}
                      >
                        {t('Todos')}
                      </button>
                      {Object.entries(TIPO_LABELS).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setFiltroTipoRequisito(key)}
                          className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            filtroTipoRequisito === key
                              ? 'bg-[#00342d] text-white font-bold'
                              : 'bg-[#eae8e5] text-[#4c616c] hover:bg-[#e4e2df]'
                          }`}
                        >
                          {t(label).replace('Visa', '').replace('Visto de ', '').replace('Intercâmbio de Idiomas', t('Intercâmbio')).replace('Language Exchange', t('Intercâmbio'))}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form (Novo/Editar) */}
              {(novoRequisito || editandoRequisito) && (
                <div className="bg-white border border-[#bfc9c4]/10 shadow-2xl shadow-stone-200/50 rounded-2xl p-6 md:p-8 mb-12">
                  <h4 className="text-lg font-serif font-bold text-[#00342d] mb-5">
                    {editandoRequisito ? t('Editar Requisito') : t('Novo Requisito')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Tipo de Visto')}</label>
                      <select
                        value={formRequisito.tipo_visto}
                        onChange={(e) => setFormRequisito((prev) => ({ ...prev, tipo_visto: e.target.value }))}
                        className="mt-2 w-full border border-[#bfc9c4] rounded-lg px-4 py-3 text-sm focus:border-[#00342d] focus:ring-1 focus:ring-[#00342d]/20 outline-none bg-white"
                      >
                        <option value="">{t('Selecione...')}</option>
                        {Object.entries(TIPO_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{t(label)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('País de Destino')}</label>
                      <input
                        type="text"
                        value={formRequisito.pais_destino}
                        onChange={(e) => setFormRequisito((prev) => ({ ...prev, pais_destino: e.target.value }))}
                        placeholder={t('Ex: Estados Unidos')}
                        className="mt-2 w-full border border-[#bfc9c4] rounded-lg px-4 py-3 text-sm focus:border-[#00342d] focus:ring-1 focus:ring-[#00342d]/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Validade Mínima do Passaporte (meses)')}</label>
                      <input
                        type="number"
                        value={formRequisito.validade_minima_passaporte_meses}
                        onChange={(e) => setFormRequisito((prev) => ({ ...prev, validade_minima_passaporte_meses: parseInt(e.target.value) || 6 }))}
                        className="mt-2 w-full border border-[#bfc9c4] rounded-lg px-4 py-3 text-sm focus:border-[#00342d] focus:ring-1 focus:ring-[#00342d]/20 outline-none"
                      />
                    </div>
                    <div className="flex items-end pb-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formRequisito.ativo}
                          onChange={(e) => setFormRequisito((prev) => ({ ...prev, ativo: e.target.checked }))}
                          className="w-4 h-4 rounded accent-[#00342d]"
                        />
                        <span className="text-sm text-[#1b1c1a] font-medium">{t('Ativo')}</span>
                      </label>
                    </div>
                  </div>
                  <div className="mb-5">
                    <label className="text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Documentos Obrigatórios')}</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {TIPOS_DOCUMENTO_OPTIONS.map(({ value, label }) => (
                        <label key={value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs cursor-pointer border transition-all ${
                          formRequisito.documentos_obrigatorios.includes(value)
                            ? 'bg-[#a0f2e1] text-[#00342d] border-[#00342d]/20 font-bold'
                            : 'bg-[#efeeeb] text-[#4c616c] border-[#bfc9c4]/30 hover:bg-[#eae8e5]'
                        }`}>
                          <input
                            type="checkbox"
                            checked={formRequisito.documentos_obrigatorios.includes(value)}
                            onChange={(e) => {
                              setFormRequisito((prev) => ({
                                ...prev,
                                documentos_obrigatorios: e.target.checked
                                  ? [...prev.documentos_obrigatorios, value]
                                  : prev.documentos_obrigatorios.filter((d) => d !== value),
                              }));
                            }}
                            className="hidden"
                          />
                          {t(label)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2 border-t border-[#bfc9c4]/10">
                    <button
                      onClick={handleSalvarRequisito}
                      disabled={salvandoRequisito || !formRequisito.tipo_visto || !formRequisito.pais_destino}
                      className="flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold bg-[#00342d] text-white hover:bg-[#004d43] transition-all shadow-lg shadow-[#00342d]/10 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {salvandoRequisito ? (
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">save</span>
                      )}
                      {editandoRequisito ? t('Atualizar') : t('Salvar')}
                    </button>
                    <button
                      onClick={() => { setNovoRequisito(false); setEditandoRequisito(null); }}
                      className="px-6 py-3 rounded-md text-sm text-[#4c616c] font-medium hover:bg-[#f5f3f0] transition-all"
                    >
                      {t('Cancelar')}
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              {carregandoRequisitos ? (
                <div className="text-center py-12 text-[#707975]">{t('Carregando requisitos...')}</div>
              ) : requisitos.length === 0 ? (
                <div className="bg-white border border-[#bfc9c4]/5 shadow-2xl shadow-stone-200/50 rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#f5f3f0] flex items-center justify-center mx-auto mb-4 text-[#4c616c]">
                    <span className="material-symbols-outlined text-[36px]">checklist</span>
                  </div>
                  <h3 className="text-xl font-bold text-[#1b1c1a] mb-2 font-serif">{t('Nenhum requisito configurado')}</h3>
                  <p className="text-[#4c616c]">{t('Configure requisitos de documentação por tipo de visto e país de destino.')}</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-stone-200/50 border border-[#bfc9c4]/5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#eae8e5]/50">
                          <th className="px-6 py-5 text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Tipo de Visto')}</th>
                          <th className="px-6 py-5 text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('País')}</th>
                          <th className="px-6 py-5 text-[11px] uppercase tracking-widest text-[#4c616c] font-bold hidden md:table-cell">{t('Documentos Obrigatórios')}</th>
                          <th className="px-6 py-5 text-[11px] uppercase tracking-widest text-[#4c616c] font-bold hidden lg:table-cell">{t('Validade Mín.')}</th>
                          <th className="px-6 py-5 text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Status')}</th>
                          <th className="px-6 py-5 text-right text-[11px] uppercase tracking-widest text-[#4c616c] font-bold">{t('Ações')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#efeeeb]">
                        {requisitosFiltrados.map((req) => {
                          const MAX_VISIBLE_DOCS = 3;
                          const visibleDocs = req.documentos_obrigatorios.slice(0, MAX_VISIBLE_DOCS);
                          const extraCount = req.documentos_obrigatorios.length - MAX_VISIBLE_DOCS;

                          return (
                            <tr key={req.id} className="hover:bg-[#f5f3f0]/50 transition-colors group">
                              <td className="px-6 py-6">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-[#00342d]">{t(TIPO_LABELS[req.tipo_visto] || req.tipo_visto)}</span>
                                  <span className="text-[10px] text-[#4c616c]/60 uppercase">{req.tipo_visto.replace(/_/g, ' ')}</span>
                                </div>
                              </td>
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-3">
                                  {getCountryFlag(req.pais_destino) ? (
                                    <span className="text-base leading-none" aria-hidden="true">{getCountryFlag(req.pais_destino)}</span>
                                  ) : (
                                    <span className="material-symbols-outlined text-sm text-[#00342d]">flag</span>
                                  )}
                                  <span className="text-sm font-medium text-[#1b1c1a]">{req.pais_destino}</span>
                                </div>
                              </td>
                              <td className="px-6 py-6 hidden md:table-cell">
                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                  {visibleDocs.map((doc) => (
                                    <span key={doc} className="px-2 py-0.5 bg-[#efeeeb] text-[10px] font-bold text-[#526772] rounded tracking-tight">
                                      {t(TIPO_DOCUMENTO_LABELS[doc] || doc)}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="px-2 py-0.5 bg-[#efeeeb] text-[10px] font-bold text-[#526772] rounded tracking-tight">
                                      +{extraCount} {t('mais')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-6 text-sm text-[#4c616c] hidden lg:table-cell">{req.validade_minima_passaporte_meses} {t('meses')}</td>
                              <td className="px-6 py-6">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${req.ativo ? 'bg-[#00342d]' : 'bg-[#bfc9c4]'}`}></span>
                                  <span className={`text-xs font-bold ${req.ativo ? 'text-[#00342d]' : 'text-[#4c616c] opacity-50'}`}>
                                    {req.ativo ? t('Ativo') : t('Inativo')}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-6 text-right">
                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => iniciarEdicaoRequisito(req)}
                                    className="text-[#4c616c] hover:text-[#00342d] transition-colors"
                                    title={t('Editar')}
                                  >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleExcluirRequisito(req.id)}
                                    className="text-[#4c616c] hover:text-[#ba1a1a] transition-colors"
                                    title={t('Excluir')}
                                  >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination footer */}
                  <div className="px-6 py-4 bg-[#f5f3f0]/30 flex justify-between items-center border-t border-[#efeeeb]">
                    <span className="text-[10px] text-[#4c616c] uppercase tracking-widest">
                      {t('Exibindo')} {requisitosFiltrados.length} {t('de')} {requisitos.length} {t('resultados')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-[#00342d]/5 bg-[#fbf9f6] mt-auto">
          <div className="flex flex-col md:flex-row justify-between items-center py-12 px-4 md:px-8 max-w-[1440px] mx-auto space-y-6 md:space-y-0">
            <div className="font-serif text-xl font-bold text-[#00342d]">YouVisa</div>
            <div className="text-sm tracking-wide text-[#4c616c]">{t('© 2024 YouVisa. Consultoria de Elite em Imigração.')}</div>
            <div className="flex space-x-6">
              <a className="text-sm tracking-wide text-[#4c616c] hover:text-[#00342d] transition-colors" href="#">{t('Termos de Uso')}</a>
            </div>
          </div>
        </footer>
      </main>

      {/* Confirmation Modal */}
      <ConfirmModal
        aberto={!!confirmacao}
        titulo={t('Confirmar alteração de status')}
        mensagem={
          confirmacao
            ? `${t('Alterar o status do processo')} #${confirmacao.processoId} ${t('do cliente')} "${confirmacao.clienteNome}" ${t('para')} "${t(STATUS_LABELS[confirmacao.status]?.label || confirmacao.status)}"?${confirmacao.observacao ? ` ${t('Observação')}: "${confirmacao.observacao}".` : ''} ${t('O cliente receberá uma notificação por e-mail.')}`
            : ''
        }
        textoBotaoConfirmar={t('Confirmar Alteração')}
        icone="swap_horiz"
        variante="info"
        onConfirmar={confirmarAtualizacao}
        onCancelar={() => setConfirmacao(null)}
      />
    </>
  );
}
