'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import ConfirmModal from '@/components/ConfirmModal';
import ProcessoTimeline from '@/components/ProcessoTimeline';
import {
  uploadDocumento,
  gerarCodigoTelegram,
  desvincularTelegram,
  Processo,
  Documento,
  Transicao,
  SolicitacaoDocumento,
  TelegramCodigoResponse,
} from '@/lib/api';
import { useProcessosUsuario, useDocumentos, useHistorico, useSolicitacoes, useTelegramStatus } from '@/hooks/use-queries';
import { useExcluirDocumento } from '@/hooks/use-mutations';
import { useSSE } from '@/hooks/use-sse';
import AlertMessage from '@/components/AlertMessage';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateOnlyPtBr } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const STATUS_LABELS: Record<string, { label: string; cor: string; icone: string }> = {
  recebido: { label: 'Recebido', cor: 'bg-[#cfe6f2] text-[#071e27]', icone: 'inbox' },
  em_analise: { label: 'Em Análise', cor: 'bg-[#cfe6f2] text-[#354a53]', icone: 'search' },
  documentos_pendentes: { label: 'Documentos Pendentes', cor: 'bg-[#ffdad6] text-[#93000a]', icone: 'pending_actions' },
  em_processamento: { label: 'Em Processamento', cor: 'bg-[#cfe6f2] text-[#071e27]', icone: 'settings' },
  aprovado: { label: 'Aprovado', cor: 'bg-[#a0f2e1] text-[#00201b]', icone: 'check_circle' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-[#ffdad6] text-[#93000a]', icone: 'cancel' },
  cancelado: { label: 'Cancelado', cor: 'bg-[#e4e2df] text-[#4c616c]', icone: 'block' },
};

const TIPO_LABELS: Record<string, string> = {
  visto_turista: 'Visto de Turista',
  visto_estudante: 'Visto de Estudante',
  visto_trabalho: 'Visto de Trabalho',
  imigracao: 'Imigração',
  intercambio: 'Intercâmbio de Idiomas',
};

const TIPOS_DOCUMENTO = [
  { value: 'passaporte', label: 'Passaporte' },
  { value: 'foto', label: 'Foto 3x4' },
  { value: 'comprovante_financeiro', label: 'Comprovante Financeiro' },
  { value: 'carta_convite', label: 'Carta Convite' },
  { value: 'seguro_viagem', label: 'Seguro Viagem' },
  { value: 'comprovante_matricula', label: 'Comprovante de Matrícula' },
  { value: 'contrato_trabalho', label: 'Contrato de Trabalho' },
  { value: 'comprovante_residencia', label: 'Comprovante de Residência' },
  { value: 'certidao_nascimento', label: 'Certidão de Nascimento' },
  { value: 'certidao_casamento', label: 'Certidão de Casamento' },
  { value: 'antecedentes_criminais', label: 'Antecedentes Criminais' },
  { value: 'exame_medico', label: 'Exame Médico' },
  { value: 'formulario_ds160', label: 'Formulário DS-160' },
  { value: 'comprovante_pagamento_taxa', label: 'Comprovante de Pagamento de Taxa' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_DOCUMENTO_LABELS: Record<string, string> = Object.fromEntries(
  TIPOS_DOCUMENTO.map((t) => [t.value, t.label])
);

const STATUS_DOC_BADGES: Record<string, { label: string; cor: string; icone: string }> = {
  pendente_revisao: { label: 'Em Revisão', cor: 'bg-[#ffdea5]/40 text-[#3d2a00]', icone: 'schedule' },
  aprovado: { label: 'Aprovado', cor: 'bg-[#a0f2e1]/40 text-[#00201b]', icone: 'check_circle' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-[#ffdad6] text-[#93000a]', icone: 'cancel' },
};

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProgressoStatus(status: string): number {
  const mapa: Record<string, number> = {
    recebido: 10,
    em_analise: 30,
    documentos_pendentes: 40,
    em_processamento: 65,
    aprovado: 100,
    rejeitado: 100,
    cancelado: 100,
  };
  return mapa[status] ?? 0;
}

interface ProcessoDetalheProps {
  processoId: number;
}

export default function ProcessoDetalhe({ processoId }: ProcessoDetalheProps) {
  const { usuario, token, logout, carregando: authCarregando } = useAuth();
  const router = useRouter();
  const { t, idioma } = useI18n();
  const locale = idioma === 'en' ? 'en-US' : 'pt-BR';

  // SSE for real-time updates
  useSSE(token, 'user');

  // Query hooks
  const processosQuery = useProcessosUsuario(token);
  const processo = processosQuery.data?.processos.find((p: Processo) => p.id === processoId) ?? null;
  const carregando = processosQuery.isLoading;

  const documentosQuery = useDocumentos(token, processoId);
  const documentos = documentosQuery.data?.documentos ?? [];
  const carregandoDocs = documentosQuery.isLoading;

  const historicoQuery = useHistorico(token, processoId);
  const historico = historicoQuery.data?.historico ?? [];
  const carregandoHistorico = historicoQuery.isLoading;

  const solicitacoesQuery = useSolicitacoes(token, processoId);
  const solicitacoes = solicitacoesQuery.data?.solicitacoes ?? [];

  const excluirMutation = useExcluirDocumento(token);

  const [erro, setErro] = useState('');

  // Document state
  const [enviandoDoc, setEnviandoDoc] = useState(false);
  const [tipoDocSelecionado, setTipoDocSelecionado] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Delete confirmation modal state
  const [confirmExcluir, setConfirmExcluir] = useState<{ documentoId: number; nomeArquivo: string } | null>(null);

  // Telegram linking state
  const [telegramCodigo, setTelegramCodigo] = useState<TelegramCodigoResponse | null>(null);
  const [telegramCarregando, setTelegramCarregando] = useState(false);
  const [confirmDesconectarTelegram, setConfirmDesconectarTelegram] = useState(false);
  const telegramQuery = useTelegramStatus(token, !!telegramCodigo);
  const telegramStatus = telegramQuery.data ?? null;

  useEffect(() => {
    if (authCarregando) return;
    if (!token || !usuario) {
      router.push('/clientes');
      return;
    }
    if (usuario.tipo === 'funcionario') {
      router.push('/admin/dashboard');
      return;
    }
  }, [token, usuario, authCarregando, router, processoId]);

  // Clear QR code when Telegram gets linked
  useEffect(() => {
    if (telegramStatus?.vinculado && telegramCodigo) {
      setTelegramCodigo(null);
    }
  }, [telegramStatus?.vinculado, telegramCodigo]);

  async function handleConectarTelegram() {
    if (!token) return;
    setTelegramCarregando(true);
    try {
      const res = await gerarCodigoTelegram(token);
      setTelegramCodigo(res);
    } catch {
      setErro(t('Erro ao gerar código de conexão do Telegram'));
    } finally {
      setTelegramCarregando(false);
    }
  }

  async function handleDesvincularTelegram() {
    if (!token) return;
    setTelegramCarregando(true);
    try {
      await desvincularTelegram(token);
      telegramQuery.refetch();
      setTelegramCodigo(null);
    } catch {
      setErro(t('Erro ao desconectar Telegram'));
    } finally {
      setTelegramCarregando(false);
    }
  }

  async function handleUploadDocumento(arquivo: File, solicitacaoId?: number) {
    if (!token) return;
    const tipoDoc = tipoDocSelecionado;
    if (!tipoDoc && !solicitacaoId) {
      setErro(t('Selecione o tipo do documento antes de enviar.'));
      return;
    }

    let tipoFinal = tipoDoc;
    if (solicitacaoId) {
      const sol = solicitacoes.find((s) => s.id === solicitacaoId);
      if (sol) tipoFinal = sol.tipo_documento;
    }
    if (!tipoFinal) return;

    setEnviandoDoc(true);
    try {
      await uploadDocumento(token, processoId, arquivo, tipoFinal, solicitacaoId);
      documentosQuery.refetch();
      solicitacoesQuery.refetch();
      processosQuery.refetch();
      if (!solicitacaoId) setTipoDocSelecionado('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao enviar documento'));
    } finally {
      setEnviandoDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function pedirConfirmacaoExcluir(documentoId: number, nomeArquivo: string) {
    setConfirmExcluir({ documentoId, nomeArquivo });
  }

  const confirmarExclusao = useCallback(async () => {
    if (!token || !confirmExcluir) return;
    const { documentoId } = confirmExcluir;
    setConfirmExcluir(null);
    try {
      await excluirMutation.mutateAsync({ processoId, documentoId });
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao excluir documento'));
    }
  }, [token, confirmExcluir, processoId, excluirMutation]);

  if (authCarregando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f6]">
        <div className="text-[#4c616c] font-[var(--font-manrope)]">{t('Carregando...')}</div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f6]">
        <span className="material-symbols-outlined text-[24px] text-[#00342d] animate-spin mr-2">progress_activity</span>
        <span className="text-[#4c616c] font-[var(--font-manrope)]">{t('Carregando processo...')}</span>
      </div>
    );
  }

  if (!processo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fbf9f6] font-[var(--font-manrope)]">
        <span className="material-symbols-outlined text-[48px] text-[#bfc9c4] mb-4">folder_off</span>
        <h2 className="text-xl font-bold text-[#1b1c1a] mb-2 font-[var(--font-serif)]">{t('Processo não encontrado')}</h2>
        <p className="text-[#4c616c] mb-6">{t('O processo solicitado não existe ou você não tem permissão.')}</p>
        <Link href="/dashboard" className="text-[#00342d] font-bold hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('Voltar ao Dashboard')}
        </Link>
      </div>
    );
  }

  const progresso = getProgressoStatus(processo.status);
  const solsPendentes = solicitacoes.filter((s) => s.status === 'pendente').length;
  const solsTotal = solicitacoes.length;
  const solsEnviados = solicitacoes.filter((s) => s.status !== 'pendente').length;

  // Docs not linked to any solicitation
  const solDocIds = new Set(solicitacoes.map(s => s.documento_id).filter(Boolean));
  const docsAvulsos = documentos.filter(d => !solDocIds.has(d.id));

  return (
    <div className="min-h-screen bg-[#fbf9f6] text-[#1b1c1a] font-[var(--font-manrope)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fbf9f6] shadow-[0_1px_3px_rgba(0,52,45,0.05)]">
        <div className="flex justify-between items-center h-20 px-4 md:px-8 max-w-screen-2xl mx-auto">
          <Link href="/dashboard" className="font-[var(--font-serif)] text-2xl font-bold tracking-tighter text-[#00342d]">
            YouVisa
          </Link>
          <nav className="hidden md:flex space-x-8 items-center">
            <Link href="/dashboard" className="font-[var(--font-serif)] text-lg font-medium tracking-tight text-[#00342d] border-b-2 border-[#00342d] pb-1">
              {t('Processos')}
            </Link>
            <Link href="/dashboard#atendimentos" className="font-[var(--font-serif)] text-lg font-medium tracking-tight text-[#4c616c] hover:text-[#00342d] transition-colors">
              {t('Atendimentos')}
            </Link>
            <div className="relative group">
              <button className="flex items-center text-[#4c616c] hover:text-[#00342d] transition-colors focus:outline-none">
                <span className="material-symbols-outlined text-2xl">account_circle</span>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg py-2 border border-[#1b1c1a]/5 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50">
                <span className="block px-4 py-2 text-sm text-[#4c616c]">
                  {t('Olá,')} <strong>{usuario.nome}</strong>
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
          </nav>
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher />
            <Link href="/dashboard" className="text-[#00342d]">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <button onClick={logout} className="text-[#4c616c] hover:text-[#ba1a1a] transition-colors">
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 md:px-8 py-6 md:py-12">
        {/* Messages */}
        {erro && <AlertMessage tipo="erro" mensagem={erro} onFechar={() => setErro('')} />}

        {/* Back link (desktop) */}
        <div className="hidden md:block mb-6">
          <Link href="/dashboard" className="text-[#4c616c] hover:text-[#00342d] text-sm font-medium flex items-center gap-1 transition-colors">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {t('Voltar ao Dashboard')}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Process & Timeline */}
          <div className="lg:col-span-8 space-y-8">
            {/* Main Process Card */}
            <div className="bg-[#f5f3f0] rounded-xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#4c616c] opacity-70">{t('Processo Ativo')}</span>
                  <h2 className="text-2xl md:text-3xl font-bold text-[#00342d] mt-1 font-[var(--font-serif)]">
                    {t(TIPO_LABELS[processo.tipo] || processo.tipo)}{processo.pais_destino ? ` (${t(processo.pais_destino)})` : ''}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-semibold text-[#00342d] font-[var(--font-serif)]">{progresso}%</div>
                  <div className="text-xs text-[#4c616c]">{t('Progresso Total')}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#eae8e5] h-2 rounded-full mb-12 overflow-hidden">
                <div className="bg-[#00342d] h-full rounded-full transition-all duration-500" style={{ width: `${progresso}%` }}></div>
              </div>

              {/* Timeline */}
              <ProcessoTimeline
                statusAtual={processo.status}
                criadoEm={processo.criado_em}
                historico={historico}
                carregando={carregandoHistorico}
              />
            </div>

            {/* Documents Section */}
            <div className="bg-[#efeeeb] rounded-xl p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-[#00342d] italic font-[var(--font-serif)]">{t('Documentos de Suporte')}</h3>
                <span className="text-xs text-[#4c616c]">
                  {solsTotal > 0 ? `${solsEnviados} ${t('enviado')}${solsEnviados !== 1 ? 's' : ''} ${t('de')} ${solsTotal} ${t('totais')}` : `${documentos.length} ${t('documento')}${documentos.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              <div className="space-y-3">
                {/* Solicitation-based documents */}
                {solicitacoes.map((sol) => {
                  const isPendente = sol.status === 'pendente' || sol.status === 'rejeitado';
                  const isEnviado = sol.status === 'enviado';
                  const isAprovado = sol.status === 'aprovado';
                  const isRejeitado = sol.status === 'rejeitado';

                  if (sol.documento_id && sol.doc_nome_original) {
                    // Document submitted
                    return (
                      <div key={sol.id} className="flex items-center justify-between p-4 bg-white rounded-lg group hover:bg-white/90 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded ${isAprovado ? 'bg-[#00342d]/5' : isRejeitado ? 'bg-[#ba1a1a]/5' : 'bg-[#3d2a00]/5'}`}>
                            <span className={`material-symbols-outlined ${isAprovado ? 'text-[#00342d]' : isRejeitado ? 'text-[#ba1a1a]' : 'text-[#3d2a00]'}`}>
                              {isAprovado ? 'verified_user' : isRejeitado ? 'gpp_bad' : 'description'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1b1c1a]">
                              {t(TIPO_DOCUMENTO_LABELS[sol.tipo_documento] || sol.tipo_documento)}
                            </p>
                            <p className="text-xs text-[#4c616c]">
                              {sol.doc_nome_original}
                              {sol.doc_tamanho ? ` · ${formatarTamanho(sol.doc_tamanho)}` : ''}
                              {sol.doc_criado_em ? ` · ${new Date(sol.doc_criado_em).toLocaleDateString(locale)}` : ''}
                            </p>
                            {isRejeitado && sol.doc_feedback && (
                              <p className="text-xs text-[#ba1a1a] mt-1 flex items-start gap-1">
                                <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">feedback</span>
                                {sol.doc_feedback}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {sol.doc_status && (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium ${STATUS_DOC_BADGES[sol.doc_status]?.cor || 'bg-[#eae8e5] text-[#4c616c]'}`}>
                              <span className="material-symbols-outlined text-[12px]">{STATUS_DOC_BADGES[sol.doc_status]?.icone || 'schedule'}</span>
                              {t(STATUS_DOC_BADGES[sol.doc_status]?.label || sol.doc_status)}
                            </span>
                          )}
                          {isAprovado && (
                            <span className="material-symbols-outlined text-[#004d43]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                          )}
                          {/* Re-upload if rejected */}
                          {isRejeitado && (
                            <label className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer bg-[#ba1a1a] text-white hover:bg-[#93000a] transition-all">
                              <span className="material-symbols-outlined text-[16px]">refresh</span>
                              {t('Reenviar')}
                              <input
                                type="file"
                                className="hidden"
                                disabled={enviandoDoc}
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadDocumento(file, sol.id);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Pending upload
                  return (
                    <div key={sol.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-dashed border-[#bfc9c4]">
                      <div className="flex items-center gap-4">
                        <div className="bg-[#3d2a00]/5 p-2 rounded">
                          <span className="material-symbols-outlined text-[#3d2a00]">badge</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-[#1b1c1a]">
                              {t(TIPO_DOCUMENTO_LABELS[sol.tipo_documento] || sol.tipo_documento)}
                            </p>
                            {sol.obrigatoria && (
                              <span className="text-[10px] font-bold text-[#93000a] bg-[#ffdad6] px-1.5 py-0.5 rounded">{t('OBRIGATÓRIO')}</span>
                            )}
                          </div>
                          <p className="text-xs text-[#ba1a1a] font-medium">
                            {sol.descricao || t('Pendente de envio')}
                          </p>
                        </div>
                      </div>
                      {!['aprovado', 'rejeitado', 'cancelado'].includes(processo.status) && (
                      <label className={`bg-[#00342d] text-white text-xs px-4 py-2 rounded-lg hover:scale-105 transition-transform cursor-pointer flex items-center gap-1 ${enviandoDoc ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {enviandoDoc ? (
                          <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">upload</span>
                        )}
                        {t('Upload')}
                        <input
                          type="file"
                          className="hidden"
                          disabled={enviandoDoc}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDocumento(file, sol.id);
                          }}
                        />
                      </label>
                      )}
                    </div>
                  );
                })}

                {/* Standalone documents (not linked to solicitations) */}
                {docsAvulsos.map((doc) => {
                  const statusDoc = STATUS_DOC_BADGES[doc.status] || STATUS_DOC_BADGES.pendente_revisao;
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white rounded-lg group hover:bg-white/90 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="bg-[#00342d]/5 p-2 rounded">
                          <span className="material-symbols-outlined text-[#00342d]">
                            {doc.tipo_arquivo?.includes('pdf') ? 'picture_as_pdf' : doc.tipo_arquivo?.includes('image') ? 'image' : 'description'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1b1c1a]">{doc.nome_original}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center bg-[#efeeeb] text-[#4c616c] px-1.5 py-0.5 rounded text-xs font-medium">
                              {t(TIPO_DOCUMENTO_LABELS[doc.tipo_documento] || doc.tipo_documento)}
                            </span>
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${statusDoc.cor}`}>
                              <span className="material-symbols-outlined text-[12px]">{statusDoc.icone}</span>
                              {t(statusDoc.label)}
                            </span>
                            <span className="text-xs text-[#707975]">
                              {formatarTamanho(doc.tamanho)} · {new Date(doc.criado_em).toLocaleDateString(locale)}
                            </span>
                          </div>
                          {doc.feedback && (
                            <p className="text-xs text-[#707975] mt-1 italic">{doc.feedback}</p>
                          )}
                        </div>
                      </div>
                      {doc.status === 'aprovado' && (
                        <span className="material-symbols-outlined text-[#004d43]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Upload additional document */}
              {!['aprovado', 'rejeitado', 'cancelado'].includes(processo.status) && <div className="mt-6 pt-6 border-t border-[#bfc9c4]/20">
                <h4 className="text-xs font-semibold text-[#4c616c] flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  {t('Enviar documento adicional (opcional)')}
                </h4>
                <div className="flex items-center gap-3">
                  <select
                    value={tipoDocSelecionado}
                    onChange={(e) => setTipoDocSelecionado(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#bfc9c4]/40 text-xs text-[#3f4945] bg-white focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all"
                  >
                    <option value="">{t('Tipo do Documento')}</option>
                    {TIPOS_DOCUMENTO.map((td) => (
                      <option key={td.value} value={td.value}>{t(td.label)}</option>
                    ))}
                  </select>

                  <label className={`flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    enviandoDoc || !tipoDocSelecionado
                      ? 'bg-[#e4e2df] text-[#707975] cursor-not-allowed'
                      : 'bg-[#00342d] text-white hover:opacity-90'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    {t('Enviar')}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      disabled={enviandoDoc || !tipoDocSelecionado}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDocumento(file);
                      }}
                    />
                  </label>
                </div>
              </div>}
            </div>
          </div>

          {/* Right Column: Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            {/* Process Data Card */}
            <div className="bg-[#00342d]/[0.03] border border-[#00342d]/10 rounded-xl p-6 shadow-md relative overflow-hidden">
              <h4 className="font-[var(--font-serif)] text-xl text-[#00342d] mb-6 italic border-b border-[#00342d]/10 pb-2 relative z-10">{t('Dados do Processo')}</h4>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Protocolo')}</span>
                  <span className="text-xs font-bold text-[#1b1c1a]">#YV-{String(processo.id).padStart(4, '0')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                  <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Status')}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_LABELS[processo.status]?.cor || 'bg-[#e4e2df] text-[#4c616c]'}`}>
                    {t(STATUS_LABELS[processo.status]?.label || processo.status)}
                  </span>
                </div>
                {processo.nome_completo && (
                  <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                    <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Nome')}</span>
                    <span className="text-xs font-bold text-[#1b1c1a]">{processo.nome_completo}</span>
                  </div>
                )}
                {processo.passaporte && (
                  <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                    <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Passaporte')}</span>
                    <span className="text-xs font-bold text-[#1b1c1a]">{processo.passaporte}</span>
                  </div>
                )}
                {processo.data_nascimento && (
                  <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                    <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Nascimento')}</span>
                    <span className="text-xs font-bold text-[#1b1c1a]">{formatDateOnlyPtBr(processo.data_nascimento)}</span>
                  </div>
                )}
                {processo.data_expiracao_passaporte && (
                  <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                    <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Expiração Passaporte')}</span>
                    <span className="text-xs font-bold text-[#1b1c1a]">{formatDateOnlyPtBr(processo.data_expiracao_passaporte)}</span>
                  </div>
                )}
                {processo.pais_destino && (
                  <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                    <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('País Destino')}</span>
                    <span className="text-xs font-bold text-[#1b1c1a]">{t(processo.pais_destino)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-t border-[#00342d]/5">
                  <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider">{t('Criado em')}</span>
                  <span className="text-xs font-bold text-[#1b1c1a]">{new Date(processo.criado_em).toLocaleDateString(locale)}</span>
                </div>
                {processo.descricao && (
                  <div className="pt-2 border-t border-[#00342d]/5">
                    <span className="text-xs text-[#4c616c] font-medium uppercase tracking-wider block mb-1">{t('Observações')}</span>
                    <p className="text-xs text-[#1b1c1a]">{processo.descricao}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Telegram Integration Card */}
            {telegramStatus && (
              <div className={telegramStatus.vinculado
                ? "bg-[#eae8e5] rounded-xl px-4 py-4 border border-[#1b1c1a]/5"
                : "bg-[#eae8e5] rounded-xl p-6 border border-[#1b1c1a]/5"
              }>
                {telegramStatus.vinculado ? (
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 p-2 bg-[#229ED9]/10 rounded-full">
                      <svg className="w-5 h-5 text-[#229ED9] fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.41-1.39-.87.03-.24.36-.49 1-.74 3.91-1.7 6.51-2.82 7.82-3.37 3.71-1.55 4.48-1.82 4.99-1.83.11 0 .36.03.52.16.14.11.18.26.2.37-.01.07-.01.14-.02.2z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#00342d] truncate">{t('Telegram Conectado')}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#006b5e] tracking-tight uppercase whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-[#006b5e] animate-pulse"></span>
                          {t('NOTIFICAÇÕES ATIVAS')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-[#4c616c] truncate font-medium">
                          {telegramStatus.telegram_username ? `@${telegramStatus.telegram_username}` : t('Conta conectada')}
                        </p>
                        <button
                          onClick={() => setConfirmDesconectarTelegram(true)}
                          disabled={telegramCarregando}
                          className="text-[10px] text-[#707975] hover:text-[#ba1a1a] transition-colors font-semibold disabled:opacity-50"
                        >
                          {t('desconectar')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : telegramCodigo ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-[#4c616c]">send</span>
                      <h4 className="font-[var(--font-serif)] text-lg text-[#00342d]">{t('Integração Telegram')}</h4>
                    </div>
                    <p className="text-sm text-[#3f4945] mb-4">{t('Escaneie o QR code para vincular.')}</p>
                    <div className="bg-white p-4 rounded-xl flex flex-col items-center mb-4">
                      <QRCodeSVG value={telegramCodigo.link || ''} size={128} />
                      <p className="text-[10px] text-[#4c616c] mt-2">{t('Escaneie para vincular sua conta')}</p>
                    </div>
                    <a
                      href={telegramCodigo.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#229ED9] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm"
                    >
                      {t('Abrir no Telegram')}
                    </a>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-[#4c616c]">send</span>
                      <h4 className="font-[var(--font-serif)] text-lg text-[#00342d]">{t('Integração Telegram')}</h4>
                    </div>
                    <p className="text-sm text-[#3f4945] mb-6">{t('Receba atualizações do seu status em tempo real diretamente no seu celular.')}</p>
                    <button
                      onClick={handleConectarTelegram}
                      disabled={telegramCarregando}
                      className="w-full bg-[#229ED9] text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm disabled:opacity-50"
                    >
                      {telegramCarregando ? t('Gerando...') : t('Vincular Telegram')}
                    </button>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs font-bold text-[#ba1a1a] uppercase">{t('Status: Não vinculado')}</span>
                      <span className="material-symbols-outlined text-[#ba1a1a] text-lg">error</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#00342d]/5 mt-20 bg-[#fbf9f6]">
        <div className="flex flex-col md:flex-row justify-between items-center py-12 px-4 md:px-8 max-w-screen-2xl mx-auto space-y-6 md:space-y-0">
          <div className="font-[var(--font-serif)] text-xl font-bold text-[#00342d]">YouVisa</div>
          <div className="text-sm tracking-wide text-[#4c616c]">{t('© 2024 YouVisa. Consultoria de Elite em Imigração.')}</div>
          <div className="flex space-x-6">
            <a className="text-sm tracking-wide text-[#4c616c] hover:text-[#00342d] transition-colors duration-200" href="#">{t('Termos de Uso')}</a>
          </div>
        </div>
      </footer>

      <ConfirmModal
        aberto={!!confirmExcluir}
        titulo={t('Excluir documento')}
        mensagem={`${t('Tem certeza que deseja excluir o arquivo')} "${confirmExcluir?.nomeArquivo}"? ${t('Esta ação não pode ser desfeita.')}`}
        textoBotaoConfirmar={t('Excluir')}
        icone="delete"
        variante="perigo"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setConfirmExcluir(null)}
      />
      <ConfirmModal
        aberto={confirmDesconectarTelegram}
        titulo={t('Desconectar Telegram')}
        mensagem={t('Tem certeza que deseja desconectar sua conta do Telegram? Você deixará de receber notificações por este canal.')}
        textoBotaoConfirmar={t('Desconectar')}
        icone="link_off"
        variante="perigo"
        onConfirmar={() => {
          setConfirmDesconectarTelegram(false);
          handleDesvincularTelegram();
        }}
        onCancelar={() => setConfirmDesconectarTelegram(false)}
      />
    </div>
  );
}
