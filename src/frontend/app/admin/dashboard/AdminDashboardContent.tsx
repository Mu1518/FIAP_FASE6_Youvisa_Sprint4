'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import ConfirmModal from '@/components/ConfirmModal';
import ProcessoTimeline from '@/components/ProcessoTimeline';
import {
  buscarTodosProcessos,
  atualizarStatusProcesso,
  buscarHistoricoProcesso,
  buscarTransicoesValidas,
  buscarDocumentosAdmin,
  getDocumentoDownloadUrl,
  avaliarDocumento,
  aprovarDocumentoComIA,
  solicitarDocumentos,
  buscarSolicitacoes,
  Processo,
  Transicao,
  Documento,
  SolicitacaoDocumento,
} from '@/lib/api';
import { formatDateOnlyPtBr } from '@/lib/utils';

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
  aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-700', icone: 'check_circle' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-700', icone: 'cancel' },
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, { label: string; cor: string }> = {
  recebido: { label: 'Recebido', cor: 'bg-slate-100 text-slate-700' },
  em_analise: { label: 'Em Análise', cor: 'bg-yellow-100 text-yellow-700' },
  documentos_pendentes: { label: 'Documentos Pendentes', cor: 'bg-orange-100 text-orange-700' },
  em_processamento: { label: 'Em Processamento', cor: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-700' },
  cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-500' },
};

const TIPO_LABELS: Record<string, string> = {
  visto_turista: 'Visto de Turista',
  visto_estudante: 'Visto de Estudante',
  visto_trabalho: 'Visto de Trabalho',
  imigracao: 'Imigração',
  intercambio: 'Intercâmbio de Idiomas',
};

export default function AdminDashboardContent() {
  const { usuario, token, logout, carregando: authCarregando } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  // Expanded row
  const [processoExpandido, setProcessoExpandido] = useState<number | null>(null);

  // Transições válidas por processo
  const [transicoesValidas, setTransicoesValidas] = useState<Record<number, string[]>>({});
  const [carregandoTransicoes, setCarregandoTransicoes] = useState<number | null>(null);

  // Histórico por processo
  const [historicos, setHistoricos] = useState<Record<number, Transicao[]>>({});
  const [carregandoHistorico, setCarregandoHistorico] = useState<number | null>(null);

  // Status update form
  const [novoStatus, setNovoStatus] = useState<Record<number, string>>({});
  const [observacao, setObservacao] = useState<Record<number, string>>({});
  const [atualizando, setAtualizando] = useState<number | null>(null);

  // Confirmation modal
  const [confirmacao, setConfirmacao] = useState<{
    processoId: number;
    status: string;
    observacao: string;
    clienteNome: string;
  } | null>(null);

  // Documentos por processo
  const [documentosAdmin, setDocumentosAdmin] = useState<Record<number, Documento[]>>({});
  const [carregandoDocs, setCarregandoDocs] = useState<number | null>(null);

  // Avaliação de documento
  const [avaliacaoAberta, setAvaliacaoAberta] = useState<{ docId: number; processoId: number; acao: 'aprovado' | 'rejeitado' } | null>(null);
  const [feedbackAvaliacao, setFeedbackAvaliacao] = useState('');
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);
  const [analisandoIaDocId, setAnalisandoIaDocId] = useState<number | null>(null);

  // Solicitações de documentos
  const [solicitacoesAdmin, setSolicitacoesAdmin] = useState<Record<number, SolicitacaoDocumento[]>>({});
  const [mostrarSolicitarDocs, setMostrarSolicitarDocs] = useState<number | null>(null);
  const [itensSolicitacao, setItensSolicitacao] = useState<Array<{ tipo_documento: string; descricao: string; obrigatoria: boolean }>>([]);
  const [novoTipoSolicitacao, setNovoTipoSolicitacao] = useState('');
  const [novaDescSolicitacao, setNovaDescSolicitacao] = useState('');
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);

  // Messages
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

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

    carregarProcessos();
  }, [token, usuario, authCarregando, router]);

  function carregarProcessos() {
    if (!token) return;
    buscarTodosProcessos(token)
      .then((res) => setProcessos(res.processos))
      .catch(() => setProcessos([]))
      .finally(() => setCarregando(false));
  }

  async function carregarTransicoes(processoId: number) {
    if (!token) return;
    setCarregandoTransicoes(processoId);
    try {
      const res = await buscarTransicoesValidas(token, processoId);
      setTransicoesValidas((prev) => ({ ...prev, [processoId]: res.transicoes_permitidas }));
    } catch {
      setTransicoesValidas((prev) => ({ ...prev, [processoId]: [] }));
    } finally {
      setCarregandoTransicoes(null);
    }
  }

  async function carregarHistorico(processoId: number) {
    if (!token) return;
    setCarregandoHistorico(processoId);
    try {
      const res = await buscarHistoricoProcesso(token, processoId);
      setHistoricos((prev) => ({ ...prev, [processoId]: res.historico }));
    } catch {
      setHistoricos((prev) => ({ ...prev, [processoId]: [] }));
    } finally {
      setCarregandoHistorico(null);
    }
  }

  async function carregarDocumentosProcesso(processoId: number) {
    if (!token) return;
    setCarregandoDocs(processoId);
    try {
      const res = await buscarDocumentosAdmin(token, processoId);
      setDocumentosAdmin((prev) => ({ ...prev, [processoId]: res.documentos }));
    } catch {
      setDocumentosAdmin((prev) => ({ ...prev, [processoId]: [] }));
    } finally {
      setCarregandoDocs(null);
    }
  }

  async function carregarSolicitacoesProcesso(processoId: number) {
    if (!token) return;
    try {
      const res = await buscarSolicitacoes(token, processoId);
      setSolicitacoesAdmin((prev) => ({ ...prev, [processoId]: res.solicitacoes }));
    } catch {
      setSolicitacoesAdmin((prev) => ({ ...prev, [processoId]: [] }));
    }
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
      setErro(err instanceof Error ? err.message : 'Erro ao baixar documento');
      setTimeout(() => setErro(''), 4000);
    }
  }

  async function handleAvaliarDocumento() {
    if (!token || !avaliacaoAberta) return;
    setEnviandoAvaliacao(true);
    try {
      await avaliarDocumento(token, avaliacaoAberta.processoId, avaliacaoAberta.docId, avaliacaoAberta.acao, feedbackAvaliacao || undefined);
      await carregarDocumentosProcesso(avaliacaoAberta.processoId);
      await carregarSolicitacoesProcesso(avaliacaoAberta.processoId);
      setSucesso(`Documento ${avaliacaoAberta.acao === 'aprovado' ? 'aprovado' : 'rejeitado'} com sucesso!`);
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao avaliar documento');
      setTimeout(() => setErro(''), 4000);
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
      const res = await aprovarDocumentoComIA(token, processoId, documentoId);
      await carregarDocumentosProcesso(processoId);
      await carregarSolicitacoesProcesso(processoId);
      setSucesso(
        res.documento.status === 'aprovado'
          ? 'Documento aprovado com IA com sucesso!'
          : 'Documento rejeitado pela IA.'
      );
      setTimeout(() => setSucesso(''), 5000);
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
      setErro(err instanceof Error ? err.message : 'Erro ao aprovar documento com IA');
      setTimeout(() => setErro(''), 5000);
    } finally {
      setAnalisandoIaDocId(null);
    }
  }

  async function handleEnviarSolicitacoes(processoId: number) {
    if (!token || itensSolicitacao.length === 0) return;
    setEnviandoSolicitacao(true);
    try {
      await solicitarDocumentos(token, processoId, itensSolicitacao);
      await carregarSolicitacoesProcesso(processoId);
      setItensSolicitacao([]);
      setMostrarSolicitarDocs(null);
      setSucesso('Documentos solicitados com sucesso! O cliente foi notificado por e-mail.');
      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao solicitar documentos');
      setTimeout(() => setErro(''), 4000);
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  function toggleProcesso(processoId: number) {
    if (processoExpandido === processoId) {
      setProcessoExpandido(null);
    } else {
      setProcessoExpandido(processoId);
      carregarTransicoes(processoId);
      carregarHistorico(processoId);
      carregarDocumentosProcesso(processoId);
      carregarSolicitacoesProcesso(processoId);
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
      await atualizarStatusProcesso(token, processoId, status, obs || undefined);
      setSucesso(`Status do processo #${processoId} atualizado para "${STATUS_LABELS[status]?.label || status}" com sucesso!`);

      // Limpar formulário
      setNovoStatus((prev) => ({ ...prev, [processoId]: '' }));
      setObservacao((prev) => ({ ...prev, [processoId]: '' }));

      // Recarregar dados
      carregarProcessos();
      carregarTransicoes(processoId);
      carregarHistorico(processoId);

      setTimeout(() => setSucesso(''), 5000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar status');
      setTimeout(() => setErro(''), 5000);
    } finally {
      setAtualizando(null);
    }
  }, [token, confirmacao]);

  if (authCarregando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-slate-300/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-300/15 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/5 px-4 md:px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">YouVisa</h2>
              <span className="text-xs font-medium bg-slate-800 text-white px-2 py-0.5 rounded-full">Admin</span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline text-sm text-slate-600">Olá, <strong>{usuario.nome}</strong></span>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-grow py-6 md:py-12 px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            {/* Messages */}
            {erro && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">error</span>
                {erro}
              </div>
            )}
            {sucesso && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                {sucesso}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Painel Administrativo</h1>
                <p className="text-slate-600 mt-1 text-sm md:text-base">Gerencie os processos de clientes</p>
              </div>
              <div className="flex items-center gap-2 bg-white/70 backdrop-blur-md border border-black/5 rounded-xl px-4 py-2 shrink-0 self-start sm:self-auto">
                <span className="material-symbols-outlined text-blue-600 text-[20px]">analytics</span>
                <span className="text-sm font-medium text-slate-700">{processos.length} processos</span>
              </div>
            </div>

            {carregando ? (
              <div className="text-center py-12 text-slate-500">Carregando processos...</div>
            ) : processos.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-600">
                  <span className="material-symbols-outlined text-[36px]">folder_open</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhum processo encontrado</h3>
                <p className="text-slate-600">Ainda não há processos cadastrados no sistema.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processos.map((p) => (
                  <div key={p.id} className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl overflow-hidden">
                    {/* Row Header — clickable */}
                    <div
                      className="px-4 md:px-6 py-4 hover:bg-white/90 transition-colors cursor-pointer"
                      onClick={() => toggleProcesso(p.id)}
                    >
                      <div className="flex items-center gap-3 md:gap-6">
                        <span className="text-sm text-slate-400 font-mono w-8 md:w-10 shrink-0">#{p.id}</span>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-bold text-slate-800">{p.usuario_nome}</span>
                            {p.usuario_email && (
                              <span className="hidden sm:inline text-xs text-slate-400">{p.usuario_email}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                            <span className="text-xs text-slate-500">{TIPO_LABELS[p.tipo] || p.tipo}</span>
                            {p.pais_destino && (
                              <>
                                <span className="text-slate-300">&middot;</span>
                                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">flight</span>
                                  {p.pais_destino}
                                </span>
                              </>
                            )}
                            <span className="text-slate-300">&middot;</span>
                            <span className="text-xs text-slate-400">
                              {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        <span className={`text-xs font-medium px-2 md:px-3 py-1 rounded-full shrink-0 ${STATUS_LABELS[p.status]?.cor || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[p.status]?.label || p.status}
                        </span>

                        <span
                          className="material-symbols-outlined text-[20px] text-slate-400 transition-transform shrink-0"
                          style={{ transform: processoExpandido === p.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Expanded Panel */}
                    {processoExpandido === p.id && (
                      <div className="border-t border-slate-100 bg-slate-50/50">
                        {/* Process Details */}
                        <div className="px-4 md:px-6 pt-5 pb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                            {p.nome_completo && (
                              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nome Completo</p>
                                <p className="text-sm text-slate-700 font-medium">{p.nome_completo}</p>
                              </div>
                            )}
                            {p.data_nascimento && (
                              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nascimento</p>
                                <p className="text-sm text-slate-700 font-medium">{formatDateOnlyPtBr(p.data_nascimento)}</p>
                              </div>
                            )}
                            {p.passaporte && (
                              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Passaporte</p>
                                <p className="text-sm text-slate-700 font-medium">{p.passaporte}</p>
                              </div>
                            )}
                            {p.data_expiracao_passaporte && (
                              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Exp. Passaporte</p>
                                <p className="text-sm text-slate-700 font-medium">{formatDateOnlyPtBr(p.data_expiracao_passaporte)}</p>
                              </div>
                            )}
                            <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Documentos</p>
                              <p className="text-sm text-slate-700 font-medium">{p.total_documentos ?? 0} arquivos</p>
                            </div>
                          </div>

                          {p.descricao && (
                            <div className="bg-white rounded-lg px-3 py-2 border border-slate-100 mb-5">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Observações do Cliente</p>
                              <p className="text-sm text-slate-600 mt-1">{p.descricao}</p>
                            </div>
                          )}
                        </div>

                        {/* Timeline */}
                        <div className="px-4 md:px-6 pb-5">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-[18px] text-blue-600">timeline</span>
                            Linha do Tempo
                          </h4>
                          <ProcessoTimeline
                            statusAtual={p.status}
                            criadoEm={p.criado_em}
                            historico={historicos[p.id] || []}
                            carregando={carregandoHistorico === p.id}
                          />
                        </div>

                        {/* Documentos do Processo */}
                        <div className="px-4 md:px-6 pb-5 border-t border-slate-100 pt-5">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-blue-600">attach_file</span>
                            Documentos ({(documentosAdmin[p.id] || []).length})
                          </h4>

                          {carregandoDocs === p.id ? (
                            <p className="text-xs text-slate-400 py-2">Carregando documentos...</p>
                          ) : (documentosAdmin[p.id] || []).length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">Nenhum documento enviado pelo cliente.</p>
                          ) : (
                            <div className="space-y-2">
                              {(documentosAdmin[p.id] || []).map((doc) => {
                                const statusDoc = STATUS_DOC_BADGES[doc.status] || STATUS_DOC_BADGES.pendente_revisao;
                                return (
                                  <div key={doc.id} className="bg-white rounded-lg px-4 py-3 border border-slate-100">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="material-symbols-outlined text-[20px] text-blue-500 shrink-0">
                                          {doc.tipo_arquivo?.includes('pdf') ? 'picture_as_pdf' : doc.tipo_arquivo?.includes('image') ? 'image' : 'description'}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-slate-700 truncate">{doc.nome_original}</p>
                                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                            <span className="inline-flex items-center bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs font-medium">
                                              {TIPO_DOCUMENTO_LABELS[doc.tipo_documento] || doc.tipo_documento}
                                            </span>
                                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${statusDoc.cor}`}>
                                              <span className="material-symbols-outlined text-[12px]">{statusDoc.icone}</span>
                                              {statusDoc.label}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                              {formatarTamanho(doc.tamanho)} &middot; {new Date(doc.criado_em).toLocaleDateString('pt-BR')}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                          onClick={() => handleDownload(p.id, doc.id, doc.nome_original)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                          title="Baixar documento"
                                        >
                                          <span className="material-symbols-outlined text-[18px]">download</span>
                                        </button>
                                        {doc.status === 'pendente_revisao' && (
                                          <>
                                            {['passaporte', 'foto'].includes(doc.tipo_documento) && (
                                              <button
                                                onClick={() => handleAprovarComIA(p.id, doc.id)}
                                                disabled={analisandoIaDocId === doc.id}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Aprovar com IA"
                                              >
                                                <span className={`material-symbols-outlined text-[18px] ${analisandoIaDocId === doc.id ? 'animate-spin' : ''}`}>
                                                  {analisandoIaDocId === doc.id ? 'progress_activity' : 'smart_toy'}
                                                </span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() => { setAvaliacaoAberta({ docId: doc.id, processoId: p.id, acao: 'aprovado' }); setFeedbackAvaliacao(''); }}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"
                                              title="Aprovar manualmente"
                                            >
                                              <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                            </button>
                                            <button
                                              onClick={() => { setAvaliacaoAberta({ docId: doc.id, processoId: p.id, acao: 'rejeitado' }); setFeedbackAvaliacao(''); }}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                              title="Rejeitar documento"
                                            >
                                              <span className="material-symbols-outlined text-[18px]">cancel</span>
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {doc.feedback && (
                                      <div className={`mt-2 ml-8 p-2 rounded-lg ${doc.status === 'rejeitado' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                                        <p className={`text-xs ${doc.status === 'rejeitado' ? 'text-red-600' : 'text-green-600'}`}>
                                          <strong>Feedback:</strong> {doc.feedback}
                                        </p>
                                      </div>
                                    )}
                                    {/* Inline avaliação */}
                                    {avaliacaoAberta?.docId === doc.id && avaliacaoAberta?.processoId === p.id && (
                                      <div className="mt-3 ml-8 p-3 bg-white border border-slate-200 rounded-lg">
                                        <p className="text-xs font-semibold text-slate-600 mb-2">
                                          {avaliacaoAberta.acao === 'aprovado' ? 'Aprovar manualmente' : 'Rejeitar documento'}
                                        </p>
                                        <textarea
                                          value={feedbackAvaliacao}
                                          onChange={(e) => setFeedbackAvaliacao(e.target.value)}
                                          placeholder={avaliacaoAberta.acao === 'rejeitado' ? 'Motivo da rejeição (recomendado)...' : 'Comentário (opcional)...'}
                                          rows={2}
                                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 focus:border-blue-500 outline-none resize-none mb-2"
                                        />
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={handleAvaliarDocumento}
                                            disabled={enviandoAvaliacao}
                                            className={`text-xs font-bold px-4 py-1.5 rounded-lg text-white transition-all ${
                                              avaliacaoAberta.acao === 'aprovado'
                                                ? 'bg-green-600 hover:bg-green-700'
                                                : 'bg-red-600 hover:bg-red-700'
                                            } disabled:opacity-50`}
                                          >
                                            {enviandoAvaliacao ? 'Salvando...' : avaliacaoAberta.acao === 'aprovado' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
                                          </button>
                                          <button
                                            onClick={() => setAvaliacaoAberta(null)}
                                            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5"
                                          >
                                            Cancelar
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
                        <div className="px-4 md:px-6 pb-5 border-t border-slate-100 pt-5">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <span className="material-symbols-outlined text-[18px] text-orange-500">assignment</span>
                              Solicitações de Documentos
                            </h4>
                            <button
                              onClick={() => {
                                setMostrarSolicitarDocs(mostrarSolicitarDocs === p.id ? null : p.id);
                                setItensSolicitacao([]);
                                setNovoTipoSolicitacao('');
                                setNovaDescSolicitacao('');
                              }}
                              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                              Solicitar Documentos
                            </button>
                          </div>

                          {/* Lista de solicitações existentes */}
                          {(solicitacoesAdmin[p.id] || []).length > 0 && (
                            <div className="space-y-2 mb-4">
                              {(solicitacoesAdmin[p.id] || []).map((sol) => {
                                const solCor =
                                  sol.status === 'pendente' ? 'bg-orange-100 text-orange-700' :
                                  sol.status === 'enviado' ? 'bg-blue-100 text-blue-700' :
                                  sol.status === 'aprovado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
                                const solLabel =
                                  sol.status === 'pendente' ? 'Aguardando Envio' :
                                  sol.status === 'enviado' ? 'Enviado - Aguardando Revisão' :
                                  sol.status === 'aprovado' ? 'Aprovado' : 'Rejeitado';
                                return (
                                  <div key={sol.id} className="bg-white rounded-lg px-4 py-2.5 border border-slate-100 flex items-center justify-between">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-700">{TIPO_DOCUMENTO_LABELS[sol.tipo_documento] || sol.tipo_documento}</span>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${solCor}`}>{solLabel}</span>
                                        {sol.obrigatoria && <span className="text-xs text-red-500 font-medium">Obrigatório</span>}
                                      </div>
                                      {sol.descricao && <p className="text-xs text-slate-500 mt-0.5">{sol.descricao}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Formulário de nova solicitação */}
                          {mostrarSolicitarDocs === p.id && (
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                              <p className="text-xs font-semibold text-slate-600 mb-3">Adicionar documentos à solicitação</p>

                              <div className="flex items-end gap-2 mb-3">
                                <div className="flex-1">
                                  <select
                                    value={novoTipoSolicitacao}
                                    onChange={(e) => setNovoTipoSolicitacao(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:border-blue-500 outline-none"
                                  >
                                    <option value="">Tipo do documento</option>
                                    {TIPOS_DOCUMENTO_OPTIONS.map((td) => (
                                      <option key={td.value} value={td.value}>{td.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={novaDescSolicitacao}
                                    onChange={(e) => setNovaDescSolicitacao(e.target.value)}
                                    placeholder="Descrição (opcional)"
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-blue-500 outline-none"
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
                                  className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-all shrink-0"
                                >
                                  <span className="material-symbols-outlined text-[16px]">add</span>
                                  Adicionar
                                </button>
                              </div>

                              {/* Itens adicionados */}
                              {itensSolicitacao.length > 0 && (
                                <div className="space-y-1 mb-3">
                                  {itensSolicitacao.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                      <div>
                                        <span className="text-sm font-medium text-slate-700">{TIPO_DOCUMENTO_LABELS[item.tipo_documento] || item.tipo_documento}</span>
                                        {item.descricao && <span className="text-xs text-slate-500 ml-2">{item.descricao}</span>}
                                      </div>
                                      <button
                                        onClick={() => setItensSolicitacao((prev) => prev.filter((_, i) => i !== idx))}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
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
                                  className="flex items-center gap-1 text-xs font-bold px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-all"
                                >
                                  {enviandoSolicitacao ? 'Enviando...' : `Enviar Solicitação (${itensSolicitacao.length})`}
                                </button>
                                <button
                                  onClick={() => { setMostrarSolicitarDocs(null); setItensSolicitacao([]); setNovoTipoSolicitacao(''); setNovaDescSolicitacao(''); }}
                                  className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Update Status Form */}
                        <div className="px-4 md:px-6 pb-6 border-t border-slate-100 pt-5">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-[18px] text-slate-600">swap_horiz</span>
                            Atualizar Status
                          </h4>

                          {carregandoTransicoes === p.id ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                              Carregando transições...
                            </div>
                          ) : (transicoesValidas[p.id] || []).length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400 py-2 bg-white rounded-lg px-4 border border-slate-100">
                              <span className="material-symbols-outlined text-[18px]">lock</span>
                              Este processo está em estado terminal ({STATUS_LABELS[p.status]?.label || p.status}). Não há transições disponíveis.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Status Selection */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-2">
                                  Novo Status <span className="text-red-500">*</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {(transicoesValidas[p.id] || []).map((statusOpt) => (
                                    <button
                                      key={statusOpt}
                                      type="button"
                                      onClick={() => setNovoStatus((prev) => ({ ...prev, [p.id]: statusOpt }))}
                                      className={`text-xs font-semibold px-4 py-2 rounded-lg border-2 transition-all ${
                                        novoStatus[p.id] === statusOpt
                                          ? statusOpt === 'aprovado'
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : statusOpt === 'rejeitado'
                                            ? 'border-red-500 bg-red-50 text-red-700'
                                            : statusOpt === 'cancelado'
                                            ? 'border-gray-400 bg-gray-50 text-gray-600'
                                            : 'border-blue-500 bg-blue-50 text-blue-700'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                      }`}
                                    >
                                      {STATUS_LABELS[statusOpt]?.label || statusOpt}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Observation */}
                              <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                                  Observação <span className="text-slate-400 font-normal">(opcional — será incluída no e-mail ao cliente)</span>
                                </label>
                                <textarea
                                  value={observacao[p.id] || ''}
                                  onChange={(e) => setObservacao((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder="Adicione uma nota ou motivo da mudança de status..."
                                  rows={2}
                                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 resize-none bg-white"
                                />
                              </div>

                              {/* Submit */}
                              <div className="flex justify-end">
                                <button
                                  disabled={!novoStatus[p.id] || atualizando === p.id}
                                  onClick={() => pedirConfirmacao(p.id, p.usuario_nome)}
                                  className="flex items-center gap-2 h-10 px-6 rounded-lg bg-slate-800 text-white text-sm font-bold shadow-lg shadow-slate-800/20 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  {atualizando === p.id ? (
                                    <>
                                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                      Atualizando...
                                    </>
                                  ) : (
                                    <>
                                      <span className="material-symbols-outlined text-[18px]">save</span>
                                      Atualizar Status
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        aberto={!!confirmacao}
        titulo="Confirmar alteração de status"
        mensagem={
          confirmacao
            ? `Alterar o status do processo #${confirmacao.processoId} do cliente "${confirmacao.clienteNome}" para "${STATUS_LABELS[confirmacao.status]?.label || confirmacao.status}"?${confirmacao.observacao ? ` Observação: "${confirmacao.observacao}".` : ''} O cliente receberá uma notificação por e-mail.`
            : ''
        }
        textoBotaoConfirmar="Confirmar Alteração"
        icone="swap_horiz"
        variante="info"
        onConfirmar={confirmarAtualizacao}
        onCancelar={() => setConfirmacao(null)}
      />
    </>
  );
}
