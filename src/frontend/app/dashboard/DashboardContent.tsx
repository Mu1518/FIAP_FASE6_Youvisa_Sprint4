'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import ConfirmModal from '@/components/ConfirmModal';
import ProcessoTimeline from '@/components/ProcessoTimeline';
import {
  buscarProcessosUsuario,
  criarProcesso,
  uploadDocumento,
  buscarDocumentos,
  excluirDocumento,
  buscarHistoricoProcesso,
  buscarSolicitacoes,
  Processo,
  Documento,
  Transicao,
  SolicitacaoDocumento,
  CriarProcessoPayload,
} from '@/lib/api';
import { formatDateOnlyPtBr } from '@/lib/utils';

const STATUS_LABELS: Record<string, { label: string; cor: string; icone: string }> = {
  recebido: { label: 'Recebido', cor: 'bg-slate-100 text-slate-700', icone: 'inbox' },
  em_analise: { label: 'Em Análise', cor: 'bg-yellow-100 text-yellow-700', icone: 'search' },
  documentos_pendentes: { label: 'Documentos Pendentes', cor: 'bg-orange-100 text-orange-700', icone: 'pending_actions' },
  em_processamento: { label: 'Em Processamento', cor: 'bg-blue-100 text-blue-700', icone: 'settings' },
  aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-700', icone: 'check_circle' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-700', icone: 'cancel' },
  cancelado: { label: 'Cancelado', cor: 'bg-gray-100 text-gray-500', icone: 'block' },
};

const TIPO_LABELS: Record<string, string> = {
  visto_turista: 'Visto de Turista',
  visto_estudante: 'Visto de Estudante',
  visto_trabalho: 'Visto de Trabalho',
  imigracao: 'Imigração',
  intercambio: 'Intercâmbio de Idiomas',
};

const TIPOS_VISTO = [
  { value: 'visto_turista', label: 'Visto de Turista', descricao: 'Para viagens de lazer e turismo' },
  { value: 'visto_estudante', label: 'Visto de Estudante', descricao: 'Para estudos no exterior' },
  { value: 'visto_trabalho', label: 'Visto de Trabalho', descricao: 'Para oportunidades profissionais' },
  { value: 'imigracao', label: 'Imigração', descricao: 'Para residência permanente' },
  { value: 'intercambio', label: 'Intercâmbio de Idiomas', descricao: 'Para cursos de idiomas' },
];

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
  pendente_revisao: { label: 'Em Revisão', cor: 'bg-yellow-100 text-yellow-700', icone: 'schedule' },
  aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-700', icone: 'check_circle' },
  rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-700', icone: 'cancel' },
};

const PAISES = [
  'Alemanha', 'Argentina', 'Austrália', 'Áustria', 'Bélgica', 'Bolívia',
  'Canadá', 'Chile', 'China', 'Colômbia', 'Coreia do Sul', 'Costa Rica',
  'Croácia', 'Cuba', 'Dinamarca', 'Egito', 'Emirados Árabes Unidos',
  'Equador', 'Escócia', 'Eslováquia', 'Eslovênia', 'Espanha',
  'Estados Unidos', 'Finlândia', 'França', 'Grécia', 'Guatemala',
  'Holanda', 'Honduras', 'Hungria', 'Índia', 'Indonésia', 'Inglaterra',
  'Irlanda', 'Islândia', 'Israel', 'Itália', 'Jamaica', 'Japão',
  'Luxemburgo', 'Malásia', 'Malta', 'Marrocos', 'México', 'Mônaco',
  'Noruega', 'Nova Zelândia', 'Panamá', 'Paraguai', 'Peru', 'Polônia',
  'Portugal', 'Reino Unido', 'República Tcheca', 'Romênia', 'Rússia',
  'Singapura', 'Suécia', 'Suíça', 'Tailândia', 'Taiwan', 'Turquia',
  'Uruguai', 'Venezuela', 'Vietnã',
];

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardContent() {
  const { usuario, token, logout, carregando: authCarregando } = useAuth();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  // Process creation form state
  const [tipoSelecionado, setTipoSelecionado] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [passaporte, setPassaporte] = useState('');
  const [dataExpiracaoPassaporte, setDataExpiracaoPassaporte] = useState('');
  const [paisDestino, setPaisDestino] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Document upload state
  const [processoExpandido, setProcessoExpandido] = useState<number | null>(null);
  const [documentos, setDocumentos] = useState<Record<number, Documento[]>>({});
  const [carregandoDocs, setCarregandoDocs] = useState<number | null>(null);
  const [enviandoDoc, setEnviandoDoc] = useState(false);
  const [tipoDocSelecionado, setTipoDocSelecionado] = useState<Record<number, string>>({});
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Timeline / historico state
  const [historicos, setHistoricos] = useState<Record<number, Transicao[]>>({});
  const [carregandoHistorico, setCarregandoHistorico] = useState<number | null>(null);

  // Solicitações de documentos
  const [solicitacoes, setSolicitacoes] = useState<Record<number, SolicitacaoDocumento[]>>({});

  // Delete confirmation modal state
  const [confirmExcluir, setConfirmExcluir] = useState<{ processoId: number; documentoId: number; nomeArquivo: string } | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (authCarregando) return;
    if (!token || !usuario) {
      router.push('/login');
      return;
    }
    if (usuario.tipo === 'funcionario') {
      router.push('/admin/dashboard');
      return;
    }

    carregarProcessos();
  }, [token, usuario, authCarregando, router]);

  function carregarProcessos() {
    if (!token) return;
    buscarProcessosUsuario(token)
      .then((res) => setProcessos(res.processos))
      .catch(() => setProcessos([]))
      .finally(() => setCarregando(false));
  }

  function limparFormulario() {
    setTipoSelecionado('');
    setNomeCompleto('');
    setDataNascimento('');
    setPassaporte('');
    setDataExpiracaoPassaporte('');
    setPaisDestino('');
    setDescricao('');
  }

  const formularioValido =
    tipoSelecionado &&
    nomeCompleto.trim() &&
    dataNascimento &&
    passaporte.trim() &&
    dataExpiracaoPassaporte &&
    paisDestino;

  async function handleCriarProcesso(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !formularioValido) return;

    setEnviando(true);
    setErro('');
    setSucesso('');

    try {
      const payload: CriarProcessoPayload = {
        tipo: tipoSelecionado,
        nome_completo: nomeCompleto.trim(),
        data_nascimento: dataNascimento,
        passaporte: passaporte.trim(),
        data_expiracao_passaporte: dataExpiracaoPassaporte,
        pais_destino: paisDestino,
        descricao: descricao.trim() || undefined,
      };
      await criarProcesso(token, payload);
      setSucesso('Processo criado com sucesso!');
      limparFormulario();
      setMostrarFormulario(false);
      carregarProcessos();
      setTimeout(() => setSucesso(''), 4000);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar processo');
    } finally {
      setEnviando(false);
    }
  }

  async function carregarDocumentos(processoId: number) {
    if (!token) return;
    setCarregandoDocs(processoId);
    try {
      const res = await buscarDocumentos(token, processoId);
      setDocumentos((prev) => ({ ...prev, [processoId]: res.documentos }));
    } catch {
      setDocumentos((prev) => ({ ...prev, [processoId]: [] }));
    } finally {
      setCarregandoDocs(null);
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

  async function carregarSolicitacoes(processoId: number) {
    if (!token) return;
    try {
      const res = await buscarSolicitacoes(token, processoId);
      setSolicitacoes((prev) => ({ ...prev, [processoId]: res.solicitacoes }));
    } catch {
      setSolicitacoes((prev) => ({ ...prev, [processoId]: [] }));
    }
  }

  function toggleProcesso(processoId: number) {
    if (processoExpandido === processoId) {
      setProcessoExpandido(null);
    } else {
      setProcessoExpandido(processoId);
      if (!documentos[processoId]) {
        carregarDocumentos(processoId);
      }
      if (!historicos[processoId]) {
        carregarHistorico(processoId);
      }
      if (!solicitacoes[processoId]) {
        carregarSolicitacoes(processoId);
      }
    }
  }

  async function handleUploadDocumento(processoId: number, arquivo: File, solicitacaoId?: number) {
    if (!token) return;
    const tipoDoc = tipoDocSelecionado[processoId];
    if (!tipoDoc && !solicitacaoId) {
      setErro('Selecione o tipo do documento antes de enviar.');
      setTimeout(() => setErro(''), 4000);
      return;
    }

    // Se é upload vinculado a uma solicitação, usar o tipo da solicitação
    let tipoFinal = tipoDoc;
    if (solicitacaoId) {
      const sol = (solicitacoes[processoId] || []).find((s) => s.id === solicitacaoId);
      if (sol) tipoFinal = sol.tipo_documento;
    }

    if (!tipoFinal) return;

    setEnviandoDoc(true);
    try {
      await uploadDocumento(token, processoId, arquivo, tipoFinal, solicitacaoId);
      await carregarDocumentos(processoId);
      await carregarSolicitacoes(processoId);
      if (!solicitacaoId) setTipoDocSelecionado((prev) => ({ ...prev, [processoId]: '' }));
      setProcessos((prev) => prev.map((proc) => proc.id === processoId ? { ...proc, total_documentos: (proc.total_documentos ?? 0) + 1 } : proc));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar documento');
      setTimeout(() => setErro(''), 4000);
    } finally {
      setEnviandoDoc(false);
      const ref = fileInputRefs.current[processoId];
      if (ref) ref.value = '';
    }
  }

  function pedirConfirmacaoExcluir(processoId: number, documentoId: number, nomeArquivo: string) {
    setConfirmExcluir({ processoId, documentoId, nomeArquivo });
  }

  const confirmarExclusao = useCallback(async () => {
    if (!token || !confirmExcluir) return;
    const { processoId, documentoId } = confirmExcluir;
    setConfirmExcluir(null);
    try {
      await excluirDocumento(token, processoId, documentoId);
      await carregarDocumentos(processoId);
      setProcessos((prev) => prev.map((proc) => proc.id === processoId ? { ...proc, total_documentos: Math.max((proc.total_documentos ?? 0) - 1, 0) } : proc));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir documento');
      setTimeout(() => setErro(''), 4000);
    }
  }, [token, confirmExcluir]);

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
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-300/15 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/5 px-4 md:px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[20px]">flight_takeoff</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">YouVisa</h2>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline text-sm text-slate-600">Olá, <strong>{usuario.nome}</strong></span>
              <button
                onClick={logout}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sair
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
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Meus Processos</h1>
                <p className="text-slate-600 mt-1 text-sm md:text-base">Acompanhe o status das suas solicitações</p>
              </div>
              <button
                onClick={() => setMostrarFormulario(!mostrarFormulario)}
                className="flex items-center justify-center gap-2 h-11 md:h-12 px-5 md:px-6 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all text-sm md:text-base shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {mostrarFormulario ? 'close' : 'add'}
                </span>
                {mostrarFormulario ? 'Cancelar' : 'Novo Processo'}
              </button>
            </div>

            {/* New Process Form */}
            {mostrarFormulario && (
              <div className="bg-white/80 backdrop-blur-md border border-black/5 shadow-lg rounded-2xl p-4 md:p-8 mb-8">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">note_add</span>
                  Nova Solicitação de Visto
                </h2>

                <form onSubmit={handleCriarProcesso} className="space-y-6">
                  {/* Visa Type Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Tipo de Visto <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {TIPOS_VISTO.map((tipo) => (
                        <button
                          key={tipo.value}
                          type="button"
                          onClick={() => setTipoSelecionado(tipo.value)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            tipoSelecionado === tipo.value
                              ? 'border-blue-600 bg-blue-50 shadow-md'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <span className={`text-sm font-bold ${tipoSelecionado === tipo.value ? 'text-blue-700' : 'text-slate-800'}`}>
                            {tipo.label}
                          </span>
                          <p className="text-xs text-slate-500 mt-1">{tipo.descricao}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Personal Info Fields */}
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-600">person</span>
                      Dados Pessoais
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="nomeCompleto" className="block text-sm font-medium text-slate-600 mb-1">
                          Nome Completo <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="nomeCompleto"
                          type="text"
                          required
                          value={nomeCompleto}
                          onChange={(e) => setNomeCompleto(e.target.value)}
                          placeholder="Nome completo conforme passaporte"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label htmlFor="dataNascimento" className="block text-sm font-medium text-slate-600 mb-1">
                          Data de Nascimento <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="dataNascimento"
                          type="date"
                          required
                          value={dataNascimento}
                          onChange={(e) => setDataNascimento(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Passport Fields */}
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-600">badge</span>
                      Dados do Passaporte
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="passaporte" className="block text-sm font-medium text-slate-600 mb-1">
                          Número do Passaporte <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="passaporte"
                          type="text"
                          required
                          value={passaporte}
                          onChange={(e) => setPassaporte(e.target.value)}
                          placeholder="Ex: AB123456"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                        />
                      </div>

                      <div>
                        <label htmlFor="dataExpiracaoPassaporte" className="block text-sm font-medium text-slate-600 mb-1">
                          Data de Expiração do Passaporte <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="dataExpiracaoPassaporte"
                          type="date"
                          required
                          value={dataExpiracaoPassaporte}
                          onChange={(e) => setDataExpiracaoPassaporte(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Destination Country */}
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-600">flight</span>
                      Destino
                    </h3>
                    <div>
                      <label htmlFor="paisDestino" className="block text-sm font-medium text-slate-600 mb-1">
                        País de Destino <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="paisDestino"
                        required
                        value={paisDestino}
                        onChange={(e) => setPaisDestino(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800 bg-white"
                      >
                        <option value="">Selecione o país de destino</option>
                        {PAISES.map((pais) => (
                          <option key={pais} value={pais}>{pais}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="border-t border-slate-100 pt-6">
                    <label htmlFor="descricao" className="block text-sm font-semibold text-slate-700 mb-2">
                      Observações <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                      id="descricao"
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva detalhes adicionais sobre sua solicitação..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 resize-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={enviando || !formularioValido}
                      className="flex items-center gap-2 h-12 px-8 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {enviando ? (
                        <>
                          <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                          Criando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[20px]">send</span>
                          Criar Processo
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Process List */}
            {carregando ? (
              <div className="text-center py-12 text-slate-500">Carregando processos...</div>
            ) : processos.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600">
                  <span className="material-symbols-outlined text-[36px]">folder_open</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Nenhum processo encontrado</h3>
                <p className="text-slate-600 mb-6">Você ainda não possui nenhuma solicitação de visto ou serviço.</p>
                <button
                  onClick={() => setMostrarFormulario(true)}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  Iniciar Nova Solicitação
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {processos.map((p) => (
                  <div key={p.id} className="bg-white/70 backdrop-blur-md border border-black/5 shadow-sm rounded-2xl overflow-hidden">
                    {/* Process Card Header */}
                    <div
                      className="p-4 md:p-6 hover:bg-white/90 transition-colors cursor-pointer"
                      onClick={() => toggleProcesso(p.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-800">
                              {TIPO_LABELS[p.tipo] || p.tipo}
                            </h3>
                            <span className="material-symbols-outlined text-[18px] text-slate-400 transition-transform" style={{ transform: processoExpandido === p.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              expand_more
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                            {p.nome_completo && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">person</span>
                                {p.nome_completo}
                              </span>
                            )}
                            {p.pais_destino && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">flight</span>
                                {p.pais_destino}
                              </span>
                            )}
                            {p.passaporte && (
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">badge</span>
                                {p.passaporte}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">folder</span>
                              {p.total_documentos ?? 0} {(p.total_documentos ?? 0) === 1 ? 'arquivo' : 'arquivos'}
                            </span>
                            {(p.total_solicitacoes_pendentes ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-orange-600 font-semibold">
                                <span className="material-symbols-outlined text-[14px]">priority_high</span>
                                {p.total_solicitacoes_pendentes} {p.total_solicitacoes_pendentes === 1 ? 'documento solicitado' : 'documentos solicitados'}
                              </span>
                            )}
                          </div>
                          {p.descricao && (
                            <p className="text-slate-600 mt-1 text-sm">{p.descricao}</p>
                          )}
                          <p className="text-slate-400 text-xs mt-2">
                            Criado em {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-3 py-1 rounded-full shrink-0 ${STATUS_LABELS[p.status]?.cor || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABELS[p.status]?.label || p.status}
                        </span>
                      </div>
                    </div>

                    {/* Expanded: Timeline + Document Section */}
                    {processoExpandido === p.id && (
                      <div className="border-t border-slate-100 px-4 md:px-6 py-5 bg-slate-50/50">
                        {/* Timeline / Linha do Tempo */}
                        <div className="mb-6">
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

                        {/* Process Details */}
                        <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                          {p.nome_completo && (
                            <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nome Completo</p>
                              <p className="text-sm text-slate-700 font-medium">{p.nome_completo}</p>
                            </div>
                          )}
                          {p.data_nascimento && (
                            <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Data Nascimento</p>
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
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Expiração Passaporte</p>
                              <p className="text-sm text-slate-700 font-medium">{formatDateOnlyPtBr(p.data_expiracao_passaporte)}</p>
                            </div>
                          )}
                          {p.pais_destino && (
                            <div className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">País de Destino</p>
                              <p className="text-sm text-slate-700 font-medium">{p.pais_destino}</p>
                            </div>
                          )}
                        </div>

                        {/* Documentação — Cards de solicitações */}
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-blue-600">folder_open</span>
                            Documentação
                            {(() => {
                              const sols = solicitacoes[p.id] || [];
                              const pendentes = sols.filter((s) => s.status === 'pendente').length;
                              const total = sols.length;
                              const enviados = sols.filter((s) => s.status !== 'pendente').length;
                              return total > 0 ? (
                                <span className="text-xs font-normal text-slate-400 ml-1">
                                  ({enviados}/{total} enviados{pendentes > 0 ? ` · ${pendentes} pendente${pendentes > 1 ? 's' : ''}` : ''})
                                </span>
                              ) : null;
                            })()}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(solicitacoes[p.id] || []).map((sol) => {
                              const isPendente = sol.status === 'pendente' || sol.status === 'rejeitado';
                              const isEnviado = sol.status === 'enviado';
                              const isAprovado = sol.status === 'aprovado';
                              const isRejeitado = sol.status === 'rejeitado';

                              const borderColor = isPendente
                                ? (isRejeitado ? 'border-red-300 bg-red-50/50' : 'border-dashed border-orange-300 bg-orange-50/30')
                                : isEnviado
                                ? 'border-blue-200 bg-blue-50/30'
                                : isAprovado
                                ? 'border-green-200 bg-green-50/30'
                                : 'border-slate-200 bg-white';

                              const statusIcone = isPendente && !isRejeitado ? 'upload_file' : isEnviado ? 'hourglass_top' : isAprovado ? 'check_circle' : 'cancel';
                              const statusCor = isPendente && !isRejeitado ? 'text-orange-500' : isEnviado ? 'text-blue-500' : isAprovado ? 'text-green-500' : 'text-red-500';

                              return (
                                <div key={sol.id} className={`rounded-xl border-2 p-4 transition-all ${borderColor}`}>
                                  {/* Header do card */}
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`material-symbols-outlined text-[22px] ${statusCor}`}>{statusIcone}</span>
                                      <div>
                                        <p className="text-sm font-bold text-slate-800">
                                          {TIPO_DOCUMENTO_LABELS[sol.tipo_documento] || sol.tipo_documento}
                                        </p>
                                        {sol.descricao && (
                                          <p className="text-xs text-slate-500">{sol.descricao}</p>
                                        )}
                                      </div>
                                    </div>
                                    {sol.obrigatoria && (
                                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">OBRIGATÓRIO</span>
                                    )}
                                  </div>

                                  {/* Conteúdo: arquivo enviado ou área de upload */}
                                  {sol.documento_id && sol.doc_nome_original ? (
                                    /* Arquivo já enviado */
                                    <div className="mt-3">
                                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 border border-slate-100">
                                        <span className="material-symbols-outlined text-[20px] text-blue-500 shrink-0">
                                          {sol.doc_tipo_arquivo?.includes('pdf') ? 'picture_as_pdf' : sol.doc_tipo_arquivo?.includes('image') ? 'image' : 'description'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium text-slate-700 truncate">{sol.doc_nome_original}</p>
                                          <p className="text-xs text-slate-400">
                                            {sol.doc_tamanho ? formatarTamanho(sol.doc_tamanho) : ''}{sol.doc_criado_em ? ` · ${new Date(sol.doc_criado_em).toLocaleDateString('pt-BR')}` : ''}
                                          </p>
                                        </div>
                                        {sol.doc_status && (
                                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_DOC_BADGES[sol.doc_status]?.cor || 'bg-slate-100 text-slate-600'}`}>
                                            <span className="material-symbols-outlined text-[12px]">{STATUS_DOC_BADGES[sol.doc_status]?.icone || 'schedule'}</span>
                                            {STATUS_DOC_BADGES[sol.doc_status]?.label || sol.doc_status}
                                          </span>
                                        )}
                                      </div>
                                      {/* Feedback de rejeição */}
                                      {isRejeitado && sol.doc_feedback && (
                                        <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                                          <p className="text-xs text-red-600 flex items-start gap-1">
                                            <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">feedback</span>
                                            {sol.doc_feedback}
                                          </p>
                                        </div>
                                      )}
                                      {/* Botão de reenvio se rejeitado */}
                                      {isRejeitado && (
                                        <label className="mt-2 flex items-center justify-center gap-1 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer bg-red-500 text-white hover:bg-red-600 transition-all w-full">
                                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                                          Reenviar documento
                                          <input
                                            type="file"
                                            className="hidden"
                                            disabled={enviandoDoc}
                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleUploadDocumento(p.id, file, sol.id);
                                            }}
                                          />
                                        </label>
                                      )}
                                    </div>
                                  ) : (
                                    /* Área de upload — card clicável */
                                    <label className="mt-3 flex flex-col items-center justify-center gap-1 py-5 rounded-lg border-2 border-dashed border-slate-200 bg-white cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
                                      {enviandoDoc ? (
                                        <>
                                          <span className="material-symbols-outlined text-[28px] text-blue-400 animate-spin">progress_activity</span>
                                          <span className="text-xs text-blue-500 font-medium">Enviando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="material-symbols-outlined text-[28px] text-slate-300 group-hover:text-blue-500 transition-colors">cloud_upload</span>
                                          <span className="text-xs text-slate-400 group-hover:text-blue-600 font-medium transition-colors">Clique para enviar</span>
                                          <span className="text-[10px] text-slate-300">PDF, JPG, PNG, DOC</span>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        className="hidden"
                                        disabled={enviandoDoc}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleUploadDocumento(p.id, file, sol.id);
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Upload avulso — documentos adicionais */}
                        <div className="mb-2">
                          <h4 className="text-xs font-semibold text-slate-500 flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                            Enviar documento adicional (opcional)
                          </h4>
                          <div className="flex items-center gap-3">
                            <select
                              value={tipoDocSelecionado[p.id] || ''}
                              onChange={(e) => setTipoDocSelecionado((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            >
                              <option value="">Tipo do Documento</option>
                              {TIPOS_DOCUMENTO.map((td) => (
                                <option key={td.value} value={td.value}>{td.label}</option>
                              ))}
                            </select>

                            <label className={`flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer transition-all ${
                              enviandoDoc || !tipoDocSelecionado[p.id]
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-700 text-white hover:bg-slate-800'
                            }`}>
                              <span className="material-symbols-outlined text-[16px]">upload</span>
                              Enviar
                              <input
                                ref={(el) => { fileInputRefs.current[p.id] = el; }}
                                type="file"
                                className="hidden"
                                disabled={enviandoDoc || !tipoDocSelecionado[p.id]}
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadDocumento(p.id, file);
                                }}
                              />
                            </label>
                          </div>
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

      <ConfirmModal
        aberto={!!confirmExcluir}
        titulo="Excluir documento"
        mensagem={`Tem certeza que deseja excluir o arquivo "${confirmExcluir?.nomeArquivo}"? Esta ação não pode ser desfeita.`}
        textoBotaoConfirmar="Excluir"
        icone="delete"
        variante="perigo"
        onConfirmar={confirmarExclusao}
        onCancelar={() => setConfirmExcluir(null)}
      />
    </>
  );
}
