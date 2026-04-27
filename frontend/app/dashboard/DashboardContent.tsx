'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import {
  criarProcesso,
  uploadDocumento,
  extrairDadosPassaporte,
  gerarCodigoTelegram,
  desvincularTelegram,
  buscarHistoricoAtendimentos,
  Processo,
  CriarProcessoPayload,
  DadosExtraidosPassaporte,
  TelegramCodigoResponse,
  HandoffComMensagens,
} from '@/lib/api';
import { useProcessosUsuario, useTelegramStatus } from '@/hooks/use-queries';
import { useSSE } from '@/hooks/use-sse';
import { ProcessoCardSkeleton } from '@/components/Skeleton';
import AlertMessage from '@/components/AlertMessage';
import ConfirmModal from '@/components/ConfirmModal';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateOnlyPtBr } from '@/lib/utils';
import { getCountryFlag } from '@/lib/country-flags';
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

const TIPO_ICONES: Record<string, string> = {
  visto_turista: 'public',
  visto_estudante: 'school',
  visto_trabalho: 'work',
  imigracao: 'home',
  intercambio: 'translate',
};

const TIPOS_VISTO = [
  { value: 'visto_turista', label: 'Visto de Turista', descricao: 'Para viagens de lazer e turismo' },
  { value: 'visto_estudante', label: 'Visto de Estudante', descricao: 'Para estudos no exterior' },
  { value: 'visto_trabalho', label: 'Visto de Trabalho', descricao: 'Para oportunidades profissionais' },
  { value: 'imigracao', label: 'Imigração', descricao: 'Para residência permanente' },
  { value: 'intercambio', label: 'Intercâmbio de Idiomas', descricao: 'Para cursos de idiomas' },
];

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

function isTerminal(status: string): boolean {
  return status === 'aprovado' || status === 'rejeitado' || status === 'cancelado';
}

function hasActionRequired(processo: Processo): boolean {
  return processo.status === 'documentos_pendentes' || (processo.total_solicitacoes_pendentes ?? 0) > 0;
}

export default function DashboardContent() {
  const { usuario, token, logout, carregando: authCarregando } = useAuth();
  useSSE(token, 'user');
  const processosQuery = useProcessosUsuario(token);
  const processos = processosQuery.data?.processos ?? [];
  const carregando = processosQuery.isLoading;
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'processos' | 'atendimentos'>('processos');
  const [atendimentos, setAtendimentos] = useState<HandoffComMensagens[]>([]);
  const [atendimentosCarregando, setAtendimentosCarregando] = useState(false);
  const [atendimentoAberto, setAtendimentoAberto] = useState<number | null>(null);

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

  // Passport scan state
  const [modoPreenchimento, setModoPreenchimento] = useState<'escolha' | 'scan' | 'manual'>('escolha');
  const [escaneando, setEscaneando] = useState(false);
  const [scanConcluido, setScanConcluido] = useState(false);
  const [arquivoPassaporte, setArquivoPassaporte] = useState<File | null>(null);
  const [previewPassaporte, setPreviewPassaporte] = useState<string | null>(null);
  const [dadosExtraidos, setDadosExtraidos] = useState<DadosExtraidosPassaporte | null>(null);
  const [passaporteNomeArquivo, setPassaporteNomeArquivo] = useState<string | null>(null);
  const passaporteScanRef = useRef<HTMLInputElement | null>(null);

  // Telegram linking state
  const [telegramCodigo, setTelegramCodigo] = useState<TelegramCodigoResponse | null>(null);
  const [telegramCarregando, setTelegramCarregando] = useState(false);
  const [confirmDesconectarTelegram, setConfirmDesconectarTelegram] = useState(false);
  const telegramQuery = useTelegramStatus(token, !!telegramCodigo);
  const telegramStatus = telegramQuery.data ?? null;

  const router = useRouter();
  const { t, idioma } = useI18n();
  const locale = idioma === 'en' ? 'en-US' : 'pt-BR';

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
  }, [token, usuario, authCarregando, router]);

  // Open atendimentos tab when navigating from process detail page
  useEffect(() => {
    if (window.location.hash === '#atendimentos') {
      setAbaAtiva('atendimentos');
      window.history.replaceState(null, '', '/dashboard');
    }
  }, []);

  // Clear QR code when Telegram gets linked
  useEffect(() => {
    if (telegramStatus?.vinculado && telegramCodigo) {
      setTelegramCodigo(null);
    }
  }, [telegramStatus?.vinculado, telegramCodigo]);

  useEffect(() => {
    if (abaAtiva !== 'atendimentos' || !token) return;
    setAtendimentosCarregando(true);
    buscarHistoricoAtendimentos(token)
      .then((r) => setAtendimentos(r.handoffs))
      .catch(() => setErro(t('Erro ao carregar atendimentos')))
      .finally(() => setAtendimentosCarregando(false));
  }, [abaAtiva, token]);

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

  function limparFormulario() {
    setTipoSelecionado('');
    setNomeCompleto('');
    setDataNascimento('');
    setPassaporte('');
    setDataExpiracaoPassaporte('');
    setPaisDestino('');
    setDescricao('');
    setModoPreenchimento('escolha');
    setEscaneando(false);
    setScanConcluido(false);
    setArquivoPassaporte(null);
    setPreviewPassaporte(null);
    setDadosExtraidos(null);
    setPassaporteNomeArquivo(null);
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
      const res = await criarProcesso(token, payload);
      // Se o passaporte foi escaneado, fazer upload automático do arquivo
      if (arquivoPassaporte && res.processo?.id) {
        try {
          await uploadDocumento(token, res.processo.id, arquivoPassaporte, 'passaporte');
        } catch {
          // Processo criado, mas upload falhou — usuário pode enviar depois
        }
      }
      setSucesso(t('Processo criado com sucesso!'));
      limparFormulario();
      setMostrarFormulario(false);
      processosQuery.refetch();
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao criar processo'));
    } finally {
      setEnviando(false);
    }
  }

  async function handleScanPassaporte(arquivo: File) {
    if (!token) return;
    setArquivoPassaporte(arquivo);
    setPreviewPassaporte(URL.createObjectURL(arquivo));
    setEscaneando(true);
    setScanConcluido(false);
    setDadosExtraidos(null);

    try {
      const res = await extrairDadosPassaporte(token, arquivo);
      setDadosExtraidos(res.dados);
      setPassaporteNomeArquivo(res.nome_arquivo);
      // Pre-fill form fields with extracted data
      if (res.dados.nome_completo) setNomeCompleto(res.dados.nome_completo);
      if (res.dados.data_nascimento) setDataNascimento(res.dados.data_nascimento);
      if (res.dados.passaporte) setPassaporte(res.dados.passaporte);
      if (res.dados.data_expiracao_passaporte) setDataExpiracaoPassaporte(res.dados.data_expiracao_passaporte);
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Erro ao escanear passaporte'));
      setModoPreenchimento('manual');
    } finally {
      setEscaneando(false);
      setScanConcluido(true);
    }
  }

  // Filter processes by search term
  const processosFiltrados = busca.trim()
    ? processos.filter((p) => {
        const termo = busca.toLowerCase();
        return (
          (TIPO_LABELS[p.tipo] || p.tipo).toLowerCase().includes(termo) ||
          (p.pais_destino || '').toLowerCase().includes(termo) ||
          (p.nome_completo || '').toLowerCase().includes(termo) ||
          (p.passaporte || '').toLowerCase().includes(termo) ||
          String(p.id).includes(termo)
        );
      })
    : processos;

  if (authCarregando || !usuario) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f6]">
        <div className="text-[#4c616c] font-[var(--font-manrope)]">{t('Carregando...')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf9f6] text-[#1b1c1a] font-[var(--font-manrope)]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#fbf9f6] shadow-[0_1px_3px_rgba(0,52,45,0.05)]">
        <div className="flex justify-between items-center h-20 px-4 md:px-8 max-w-screen-2xl mx-auto">
          <Link href="/dashboard" onClick={() => setAbaAtiva('processos')} className="font-[var(--font-serif)] text-2xl font-bold tracking-tighter text-[#00342d]">
            YouVisa
          </Link>
          <nav className="hidden md:flex space-x-8 items-center">
            <button
              onClick={() => setAbaAtiva('processos')}
              className={`font-[var(--font-serif)] text-lg font-medium tracking-tight pb-1 transition-colors ${
                abaAtiva === 'processos'
                  ? 'text-[#00342d] border-b-2 border-[#00342d]'
                  : 'text-[#4c616c] hover:text-[#00342d]'
              }`}
            >
              {t('Processos')}
            </button>
            <button
              onClick={() => setAbaAtiva('atendimentos')}
              className={`font-[var(--font-serif)] text-lg font-medium tracking-tight pb-1 transition-colors ${
                abaAtiva === 'atendimentos'
                  ? 'text-[#00342d] border-b-2 border-[#00342d]'
                  : 'text-[#4c616c] hover:text-[#00342d]'
              }`}
            >
              {t('Atendimentos')}
            </button>
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
          </nav>
          {/* Mobile: name + logout */}
          <div className="flex md:hidden items-center gap-3">
            <LanguageSwitcher />
            <span className="text-sm text-[#4c616c]">{t('Olá')}, <strong>{usuario.nome}</strong></span>
            <button onClick={logout} className="text-[#4c616c] hover:text-[#ba1a1a] transition-colors">
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Messages */}
        {erro && <AlertMessage tipo="erro" mensagem={erro} onFechar={() => setErro('')} />}
        {sucesso && <AlertMessage tipo="sucesso" mensagem={sucesso} onFechar={() => setSucesso('')} />}

        {abaAtiva === 'processos' && (
        <>
        {/* Welcome Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-5xl font-bold text-[#00342d] tracking-tight font-[var(--font-serif)]">
              {t('Olá')}, {usuario.nome?.split(' ')[0]}
            </h1>
            <p className="text-[#4c616c] text-base md:text-lg">
              {t('Bem-vindo à sua central de consultoria imigratória de elite.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-80 group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#707975] group-focus-within:text-[#00342d] transition-colors">search</span>
              <input
                className="w-full pl-12 pr-4 py-3 bg-[#f5f3f0] border-none focus:ring-1 focus:ring-[#00342d]/20 rounded-xl transition-all placeholder:text-[#707975] text-[#1b1c1a] outline-none"
                placeholder={t('Protocolo, país ou visto...')}
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <button
              onClick={() => { if (mostrarFormulario) limparFormulario(); setMostrarFormulario(!mostrarFormulario); }}
              className="flex items-center justify-center gap-2 bg-[#00342d] text-white px-8 py-3.5 rounded-xl font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[20px]">
                {mostrarFormulario ? 'close' : 'add'}
              </span>
              {mostrarFormulario ? t('Cancelar') : t('Novo Processo')}
            </button>
          </div>
        </section>

        {/* New Process Form */}
        {mostrarFormulario && (
          <div className="bg-white rounded-2xl p-4 md:p-8 mb-8 border border-[#bfc9c4]/20 shadow-sm">
            <h2 className="text-xl font-bold text-[#00342d] mb-6 flex items-center gap-2 font-[var(--font-serif)]">
              <span className="material-symbols-outlined text-[#00342d]">note_add</span>
              {t('Nova Solicitação de Visto')}
            </h2>

            <form onSubmit={handleCriarProcesso} className="space-y-6">
              {/* Visa Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-[#3f4945] mb-3">
                  {t('Tipo de Visto')} <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {TIPOS_VISTO.map((tipo) => (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setTipoSelecionado(tipo.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        tipoSelecionado === tipo.value
                          ? 'border-[#00342d] bg-[#a0f2e1]/20 shadow-md'
                          : 'border-[#bfc9c4]/30 hover:border-[#bfc9c4] bg-white'
                      }`}
                    >
                      <span className={`text-sm font-bold ${tipoSelecionado === tipo.value ? 'text-[#00342d]' : 'text-[#1b1c1a]'}`}>
                        {t(tipo.label)}
                      </span>
                      <p className="text-xs text-[#4c616c] mt-1">{t(tipo.descricao)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Input Mode Selection */}
              {tipoSelecionado && modoPreenchimento === 'escolha' && (
                <div className="border-t border-[#bfc9c4]/20 pt-6">
                  <h3 className="text-sm font-bold text-[#3f4945] mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#00342d]">description</span>
                    {t('Como deseja informar seus dados?')}
                  </h3>
                  <p className="text-xs text-[#4c616c] mb-4">{t('Escaneie seu passaporte para preenchimento automático ou preencha manualmente.')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setModoPreenchimento('scan')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-[#bfc9c4]/30 hover:border-[#00342d] hover:bg-[#a0f2e1]/10 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#a0f2e1]/30 group-hover:bg-[#a0f2e1]/50 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[28px] text-[#00342d]">document_scanner</span>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#00342d]">{t('Escanear Passaporte')}</span>
                        <p className="text-xs text-[#4c616c] mt-1">{t('Upload da imagem para extração automática')}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoPreenchimento('manual')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-[#bfc9c4]/30 hover:border-[#00342d] hover:bg-[#a0f2e1]/10 transition-all group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#eae8e5] group-hover:bg-[#a0f2e1]/30 flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-[28px] text-[#4c616c] group-hover:text-[#00342d]">edit_note</span>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#00342d]">{t('Preencher Manualmente')}</span>
                        <p className="text-xs text-[#4c616c] mt-1">{t('Digite os dados nos campos do formulário')}</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Passport Scan Mode */}
              {tipoSelecionado && modoPreenchimento === 'scan' && !scanConcluido && (
                <div className="border-t border-[#bfc9c4]/20 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#3f4945] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#00342d]">document_scanner</span>
                      {t('Escanear Passaporte')}
                    </h3>
                    <button type="button" onClick={() => setModoPreenchimento('escolha')} className="text-xs text-[#4c616c] hover:text-[#1b1c1a]">
                      {t('Voltar')}
                    </button>
                  </div>

                  {!escaneando && !previewPassaporte && (
                    <div
                      onClick={() => passaporteScanRef.current?.click()}
                      className="border-2 border-dashed border-[#bfc9c4] hover:border-[#00342d] rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-[#a0f2e1]/5 group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-[#a0f2e1]/30 group-hover:bg-[#a0f2e1]/50 flex items-center justify-center mx-auto mb-4 transition-colors">
                        <span className="material-symbols-outlined text-[32px] text-[#00342d]">upload_file</span>
                      </div>
                      <p className="text-sm font-semibold text-[#3f4945]">{t('Clique para enviar a imagem do passaporte')}</p>
                      <p className="text-xs text-[#4c616c] mt-1">{t('JPG, PNG ou PDF - Página de dados do passaporte')}</p>
                      <input
                        ref={passaporteScanRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleScanPassaporte(file);
                        }}
                      />
                    </div>
                  )}

                  {escaneando && previewPassaporte && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="relative rounded-2xl overflow-hidden border border-[#bfc9c4] bg-slate-900">
                        <img src={previewPassaporte} alt="Passaporte" className="w-full h-auto opacity-80" />
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#84d5c5] to-transparent shadow-[0_0_15px_rgba(0,52,45,0.5)] animate-[scanLine_2s_ease-in-out_infinite]"></div>
                        </div>
                        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#84d5c5] rounded-tl-md"></div>
                        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#84d5c5] rounded-tr-md"></div>
                        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#84d5c5] rounded-bl-md"></div>
                        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#84d5c5] rounded-br-md"></div>
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                          <div className="flex items-center gap-2 text-white text-sm">
                            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                            {t('Escaneando documento...')}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3">
                        <p className="text-sm font-semibold text-[#3f4945] mb-1">{t('Extraindo dados...')}</p>
                        {['Nome Completo', 'Data de Nascimento', 'Número do Passaporte', 'Data de Expiração'].map((campo, i) => (
                          <div key={campo} className="flex items-center gap-3 p-3 rounded-xl bg-[#f5f3f0] border border-[#bfc9c4]/20">
                            <div className="w-2 h-2 rounded-full bg-[#00342d] animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}></div>
                            <div className="flex-1">
                              <p className="text-xs text-[#4c616c]">{t(campo)}</p>
                              <div className="h-4 mt-1 bg-[#bfc9c4]/40 rounded animate-pulse w-3/4" style={{ animationDelay: `${i * 0.2}s` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Scan completed — show passport image + extracted data side by side */}
              {tipoSelecionado && modoPreenchimento === 'scan' && scanConcluido && previewPassaporte && dadosExtraidos && (
                <div className="border-t border-[#bfc9c4]/20 pt-6">
                  {/* MRZ Validation Badge */}
                  <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 ${dadosExtraidos.mrz_valido ? 'bg-[#a0f2e1]/30 border border-[#00342d]/20' : 'bg-[#ffdad6] border border-[#ba1a1a]/20'}`}>
                    <span className={`material-symbols-outlined text-[22px] ${dadosExtraidos.mrz_valido ? 'text-[#00342d]' : 'text-[#ba1a1a]'}`}>
                      {dadosExtraidos.mrz_valido ? 'verified' : 'gpp_bad'}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${dadosExtraidos.mrz_valido ? 'text-[#00201b]' : 'text-[#93000a]'}`}>
                        {dadosExtraidos.mrz_valido ? t('Passaporte Válido') : t('Documento Inválido')}
                      </p>
                      <p className={`text-xs ${dadosExtraidos.mrz_valido ? 'text-[#00342d]' : 'text-[#ba1a1a]'}`}>
                        {dadosExtraidos.mrz_motivo}
                      </p>
                    </div>
                    {!dadosExtraidos.mrz_valido && (
                      <button
                        type="button"
                        onClick={() => {
                          setScanConcluido(false);
                          setPreviewPassaporte(null);
                          setArquivoPassaporte(null);
                          setDadosExtraidos(null);
                          setPassaporteNomeArquivo(null);
                        }}
                        className="text-xs font-medium text-[#93000a] hover:text-[#ba1a1a] bg-[#ffdad6] hover:bg-[#ffdad6]/80 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {t('Tentar novamente')}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#3f4945] flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${dadosExtraidos.mrz_valido ? 'text-[#00342d]' : 'text-[#ba1a1a]'}`}>
                        {dadosExtraidos.mrz_valido ? 'check_circle' : 'error'}
                      </span>
                      {t('Dados Extraídos do Passaporte')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setScanConcluido(false);
                        setPreviewPassaporte(null);
                        setArquivoPassaporte(null);
                        setDadosExtraidos(null);
                        setPassaporteNomeArquivo(null);
                      }}
                      className="text-xs text-[#4c616c] hover:text-[#1b1c1a] flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      {t('Escanear novamente')}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative rounded-2xl overflow-hidden border border-[#00342d]/20 bg-slate-900 shadow-sm">
                      <img src={previewPassaporte} alt="Passaporte escaneado" className="w-full h-auto" />
                      <div className={`absolute top-3 right-3 ${dadosExtraidos.mrz_valido ? 'bg-[#00342d]' : 'bg-[#ba1a1a]'} text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow`}>
                        <span className="material-symbols-outlined text-[14px]">{dadosExtraidos.mrz_valido ? 'check' : 'close'}</span>
                        {dadosExtraidos.mrz_valido ? t('Passaporte Válido') : t('Documento Inválido')}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <p className="text-xs text-[#4c616c] mb-1">{t('Confira os dados extraídos. Você pode editá-los abaixo se necessário.')}</p>
                      {[
                        { label: t('Nome Completo'), value: dadosExtraidos.nome_completo, icon: 'person' },
                        { label: t('Data de Nascimento'), value: dadosExtraidos.data_nascimento ? formatDateOnlyPtBr(dadosExtraidos.data_nascimento) : null, icon: 'cake' },
                        { label: t('Número do Passaporte'), value: dadosExtraidos.passaporte, icon: 'badge' },
                        { label: t('Data de Expiração'), value: dadosExtraidos.data_expiracao_passaporte ? formatDateOnlyPtBr(dadosExtraidos.data_expiracao_passaporte) : null, icon: 'event' },
                      ].map((campo) => (
                        <div key={campo.label} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#bfc9c4]/20 shadow-sm">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${campo.value ? 'bg-[#a0f2e1]/30' : 'bg-[#ffdad6]/50'}`}>
                            <span className={`material-symbols-outlined text-[16px] ${campo.value ? 'text-[#00342d]' : 'text-[#ba1a1a]'}`}>{campo.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#4c616c]">{campo.label}</p>
                            <p className={`text-sm font-semibold truncate ${campo.value ? 'text-[#1b1c1a]' : 'text-[#ba1a1a]'}`}>
                              {campo.value || t('Não identificado — preencha abaixo')}
                            </p>
                          </div>
                          {campo.value && <span className="material-symbols-outlined text-[16px] text-[#00342d]">check_circle</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Personal Info Fields — show when manual or scan completed */}
              {tipoSelecionado && (modoPreenchimento === 'manual' || (modoPreenchimento === 'scan' && scanConcluido && dadosExtraidos?.mrz_valido !== false)) && (
              <div className="border-t border-[#bfc9c4]/20 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#3f4945] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#00342d]">person</span>
                    {t('Dados Pessoais')}
                    {modoPreenchimento === 'scan' && scanConcluido && (
                      <span className="text-xs font-normal text-[#707975] ml-1">{t('— edite se necessário')}</span>
                    )}
                  </h3>
                  {modoPreenchimento === 'manual' && (
                    <button type="button" onClick={() => setModoPreenchimento('escolha')} className="text-xs text-[#4c616c] hover:text-[#1b1c1a]">
                      {t('Voltar')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="nomeCompleto" className="block text-sm font-medium text-[#4c616c] mb-1">
                      {t('Nome Completo')} <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      id="nomeCompleto"
                      type="text"
                      required
                      value={nomeCompleto}
                      onChange={(e) => setNomeCompleto(e.target.value)}
                      placeholder={t('Nome completo conforme passaporte')}
                      className="w-full px-4 py-3 rounded-xl border border-[#bfc9c4]/40 focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all text-sm text-[#1b1c1a] placeholder:text-[#707975] bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="dataNascimento" className="block text-sm font-medium text-[#4c616c] mb-1">
                      {t('Data de Nascimento')} <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      id="dataNascimento"
                      type="date"
                      required
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#bfc9c4]/40 focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all text-sm text-[#1b1c1a] bg-white"
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Passport Fields */}
              {tipoSelecionado && (modoPreenchimento === 'manual' || (modoPreenchimento === 'scan' && scanConcluido && dadosExtraidos?.mrz_valido !== false)) && (
              <div className="border-t border-[#bfc9c4]/20 pt-6">
                <h3 className="text-sm font-bold text-[#3f4945] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#00342d]">badge</span>
                  {t('Dados do Passaporte')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="passaporte" className="block text-sm font-medium text-[#4c616c] mb-1">
                      {t('Número do Passaporte')} <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      id="passaporte"
                      type="text"
                      required
                      value={passaporte}
                      onChange={(e) => setPassaporte(e.target.value)}
                      placeholder={t('Ex: AB123456')}
                      className="w-full px-4 py-3 rounded-xl border border-[#bfc9c4]/40 focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all text-sm text-[#1b1c1a] placeholder:text-[#707975] bg-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="dataExpiracaoPassaporte" className="block text-sm font-medium text-[#4c616c] mb-1">
                      {t('Data de Expiração do Passaporte')} <span className="text-[#ba1a1a]">*</span>
                    </label>
                    <input
                      id="dataExpiracaoPassaporte"
                      type="date"
                      required
                      value={dataExpiracaoPassaporte}
                      onChange={(e) => setDataExpiracaoPassaporte(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#bfc9c4]/40 focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all text-sm text-[#1b1c1a] bg-white"
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Destination Country */}
              {tipoSelecionado && (modoPreenchimento === 'manual' || (modoPreenchimento === 'scan' && scanConcluido && dadosExtraidos?.mrz_valido !== false)) && (
              <div className="border-t border-[#bfc9c4]/20 pt-6">
                <h3 className="text-sm font-bold text-[#3f4945] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#00342d]">flight</span>
                  {t('Destino')}
                </h3>
                <div>
                  <label htmlFor="paisDestino" className="block text-sm font-medium text-[#4c616c] mb-1">
                    {t('País de Destino')} <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <select
                    id="paisDestino"
                    required
                    value={paisDestino}
                    onChange={(e) => setPaisDestino(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#bfc9c4]/40 focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all text-sm text-[#1b1c1a] bg-white"
                  >
                    <option value="">{t('Selecione o país de destino')}</option>
                    {PAISES.map((pais) => (
                      <option key={pais} value={pais}>{t(pais)}</option>
                    ))}
                  </select>
                </div>
              </div>
              )}

              {/* Description */}
              {tipoSelecionado && (modoPreenchimento === 'manual' || (modoPreenchimento === 'scan' && scanConcluido && dadosExtraidos?.mrz_valido !== false)) && (
              <div className="border-t border-[#bfc9c4]/20 pt-6">
                <label htmlFor="descricao" className="block text-sm font-semibold text-[#3f4945] mb-2">
                  {t('Observações')} <span className="text-[#707975] font-normal">{t('(opcional)')}</span>
                </label>
                <textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder={t('Descreva detalhes adicionais sobre sua solicitação...')}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-[#bfc9c4]/40 focus:border-[#00342d] focus:ring-2 focus:ring-[#00342d]/10 outline-none transition-all text-sm text-[#1b1c1a] placeholder:text-[#707975] resize-none bg-white"
                />
              </div>
              )}

              {tipoSelecionado && (modoPreenchimento === 'manual' || (modoPreenchimento === 'scan' && scanConcluido && dadosExtraidos?.mrz_valido !== false)) && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={enviando || !formularioValido || (modoPreenchimento === 'scan' && !!dadosExtraidos && !dadosExtraidos.mrz_valido)}
                  className="flex items-center gap-2 h-12 px-8 rounded-xl bg-[#00342d] text-white font-bold shadow-sm hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {enviando ? (
                    <>
                      <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                      {t('Criando...')}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">send</span>
                      {t('Criar Processo')}
                    </>
                  )}
                </button>
              </div>
              )}
            </form>
          </div>
        )}

        {/* Main Dashboard Content — 12-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Process List Area (Col 8) */}
          <div className="lg:col-span-8 space-y-8">
            <h2 className="text-2xl md:text-3xl font-bold text-[#00342d] mb-2 font-[var(--font-serif)]">{t('Processos Recentes')}</h2>

            {carregando ? (
              <div className="grid gap-6">
                {[0, 1, 2].map((i) => <ProcessoCardSkeleton key={i} />)}
              </div>
            ) : processosFiltrados.length === 0 && processos.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#bfc9c4]/10">
                <div className="w-16 h-16 rounded-2xl bg-[#a0f2e1]/20 flex items-center justify-center mx-auto mb-4 text-[#00342d]">
                  <span className="material-symbols-outlined text-[36px]">folder_open</span>
                </div>
                <h3 className="text-xl font-bold text-[#1b1c1a] mb-2 font-[var(--font-serif)]">{t('Nenhum processo encontrado')}</h3>
                <p className="text-[#4c616c] mb-6">{t('Você ainda não possui nenhuma solicitação de visto ou serviço.')}</p>
                <button
                  onClick={() => setMostrarFormulario(true)}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#00342d] text-white font-bold shadow-sm hover:opacity-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  {t('Iniciar Nova Solicitação')}
                </button>
              </div>
            ) : processosFiltrados.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#bfc9c4]/10">
                <p className="text-[#4c616c]">{t('Nenhum processo encontrado para')} &quot;{busca}&quot;</p>
              </div>
            ) : (
              <div className="space-y-6">
                {processosFiltrados.map((p) => {
                  const progresso = getProgressoStatus(p.status);
                  const terminal = isTerminal(p.status);
                  const isConcluido = p.status === 'aprovado';
                  const actionRequired = hasActionRequired(p);

                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl p-6 md:p-8 transition-all shadow-md border ${
                        terminal
                          ? 'bg-[#f5f3f0]/80 border-[#bfc9c4]/20 opacity-75 grayscale hover:grayscale-0'
                          : 'bg-white border-gray-200 hover:shadow-[0_8px_30px_rgba(0,52,45,0.06)]'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`material-symbols-outlined ${terminal && !isConcluido ? 'text-[#4c616c]' : terminal ? 'text-[#4c616c]' : 'text-[#00342d]'}`}>
                              {terminal && isConcluido ? 'verified' : (TIPO_ICONES[p.tipo] || 'public')}
                            </span>
                            <h3 className="text-xl font-bold text-[#1b1c1a] font-[var(--font-serif)]">
                              {t(TIPO_LABELS[p.tipo] || p.tipo)}{p.pais_destino ? ` - ${t(p.pais_destino)}` : ''}
                              {p.pais_destino && getCountryFlag(p.pais_destino) && (
                                <span className="ml-2" aria-hidden="true">{getCountryFlag(p.pais_destino)}</span>
                              )}
                            </h3>
                          </div>
                          <p className="text-sm text-[#4c616c]">{t('Protocolo')}: #YV-{String(p.id).padStart(4, '0')}</p>
                        </div>
                        {terminal && isConcluido ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#00342d]/10 text-[#00342d] text-xs font-bold uppercase tracking-widest border border-[#00342d]/20 shrink-0">
                            {t('Concluído')}
                          </span>
                        ) : actionRequired ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#ffdad6] text-[#93000a] text-xs font-bold uppercase tracking-widest shrink-0">
                            {t('Ação Requerida')}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shrink-0 ${STATUS_LABELS[p.status]?.cor || 'bg-[#e4e2df] text-[#4c616c]'}`}>
                            {t(STATUS_LABELS[p.status]?.label || p.status)}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar / Content for Ongoing */}
                      {!terminal ? (
                        <>
                          <div className="mb-8">
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-[#4c616c] font-medium">{t('Progresso do Processo')}</span>
                              <span className="text-[#00342d] font-bold">{progresso}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#eae8e5] rounded-full overflow-hidden">
                              <div className="h-full bg-[#00342d] rounded-full transition-all duration-500" style={{ width: `${progresso}%` }}></div>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-[#4c616c]">
                                <span className="material-symbols-outlined text-sm">schedule</span>
                                <span>{t('Última atualização')}: {new Date(p.atualizado_em).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                              {actionRequired ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="material-symbols-outlined text-[#ba1a1a] text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>priority_high</span>
                                  <span className="font-bold text-[#ba1a1a]">
                                    {t('Próxima ação')}: {p.status === 'documentos_pendentes' ? t('Fazer upload de documentos') : `${p.total_solicitacoes_pendentes} ${t('pendência(s) de análise')}`}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="material-symbols-outlined text-[#3d2a00] text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>bolt</span>
                                  <span className="font-bold text-[#3d2a00]">
                                    {t('Próxima ação')}: {t('Aguardando atualização de status')}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end">
                              {actionRequired ? (
                                <Link
                                  href={`/dashboard/processo/${p.id}`}
                                  className="px-8 py-3 rounded-xl bg-[#00342d] text-white font-bold shadow-md hover:opacity-90 transition-all text-center inline-block"
                                >
                                  {t('Resolver Pendência')}
                                </Link>
                              ) : (
                                <Link
                                  href={`/dashboard/processo/${p.id}`}
                                  className="px-8 py-3 rounded-xl border border-[#00342d] text-[#00342d] font-bold hover:bg-[#00342d] hover:text-white transition-all text-center inline-block"
                                >
                                  {t('Ver detalhes')}
                                </Link>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-[#4c616c]">{t('Finalizado em')} {new Date(p.atualizado_em).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <Link href={`/dashboard/processo/${p.id}`} className="text-[#00342d] font-bold text-sm hover:underline">
                            {t('Ver detalhes')}
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar (Col 4) */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Telegram Integration */}
            {telegramStatus && (
              <div className={telegramStatus.vinculado
                ? "bg-[#eae8e5] rounded-2xl relative overflow-hidden px-4 py-4"
                : "bg-[#eae8e5] rounded-2xl p-6 md:p-8 text-center relative overflow-hidden"
              }>
                {!telegramStatus.vinculado && (
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#00342d]/5 rounded-full blur-2xl"></div>
                )}

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
                    <div className="mb-6 inline-flex p-4 bg-white rounded-2xl shadow-sm">
                      <QRCodeSVG value={telegramCodigo.link || ''} size={96} />
                    </div>
                    <h3 className="text-xl font-bold text-[#00342d] mb-2 font-[var(--font-serif)]">{t('Vincular Telegram')}</h3>
                    <p className="text-sm text-[#4c616c] mb-4 leading-relaxed">
                      {t('Escaneie o QR code ou clique no botão abaixo para abrir no Telegram.')}
                    </p>
                    <a
                      href={telegramCodigo.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#229ED9] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all mb-3"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.41-1.39-.87.03-.24.36-.49 1-.74 3.91-1.7 6.51-2.82 7.82-3.37 3.71-1.55 4.48-1.82 4.99-1.83.11 0 .36.03.52.16.14.11.18.26.2.37-.01.07-.01.14-.02.2z" /></svg>
                      {t('Abrir no Telegram')}
                    </a>
                    <p className="text-xs text-[#707975]">{t('Código expira em 15 minutos')}</p>
                  </>
                ) : (
                  <>
                    <div className="mb-6 inline-flex p-4 bg-white rounded-2xl shadow-sm">
                      <svg className="w-24 h-24 text-[#00342d] opacity-20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.41-1.39-.87.03-.24.36-.49 1-.74 3.91-1.7 6.51-2.82 7.82-3.37 3.71-1.55 4.48-1.82 4.99-1.83.11 0 .36.03.52.16.14.11.18.26.2.37-.01.07-.01.14-.02.2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-[#00342d] mb-2 font-[var(--font-serif)]">{t('Notificações em Tempo Real')}</h3>
                    <p className="text-sm text-[#4c616c] mb-6 leading-relaxed">{t('Vincule seu Telegram para receber atualizações instantâneas sobre seus vistos.')}</p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleConectarTelegram}
                        disabled={telegramCarregando}
                        className="w-full bg-[#229ED9] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.41-1.39-.87.03-.24.36-.49 1-.74 3.91-1.7 6.51-2.82 7.82-3.37 3.71-1.55 4.48-1.82 4.99-1.83.11 0 .36.03.52.16.14.11.18.26.2.37-.01.07-.01.14-.02.2z" /></svg>
                        {telegramCarregando ? t('Gerando...') : t('Vincular Telegram')}
                      </button>
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#ba1a1a] tracking-wider uppercase">
                        <span className="w-2 h-2 rounded-full bg-[#ba1a1a]"></span>
                        {t('Status: Não vinculado')}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Ad/Info Card */}
            <div className="rounded-2xl h-48 bg-[#00342d] p-8 flex flex-col justify-end relative overflow-hidden">
              <span className="material-symbols-outlined absolute -top-4 -right-4 text-white opacity-20 leading-none" style={{ fontSize: '140px' }}>loyalty</span>
              <p className="text-white/60 text-xs font-bold tracking-widest uppercase mb-1">{t('Clube Exclusivo')}</p>
              <h4 className="text-xl font-bold text-white leading-tight font-[var(--font-serif)]">{t('Membros YouVisa possuem benefícios em bancos internacionais.')}</h4>
            </div>
          </aside>
        </div>
        </>
        )}

        {abaAtiva === 'atendimentos' && (
          <AtendimentosHistorico
            carregando={atendimentosCarregando}
            atendimentos={atendimentos}
            atendimentoAberto={atendimentoAberto}
            setAtendimentoAberto={setAtendimentoAberto}
            nomeUsuario={usuario.nome}
          />
        )}
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

const HANDOFF_STATUS_LABELS: Record<string, { label: string; cor: string; icone: string }> = {
  pendente: { label: 'Pendente', cor: 'bg-[#ffdea5] text-[#593f00]', icone: 'schedule' },
  em_atendimento: { label: 'Em Atendimento', cor: 'bg-[#a0f2e1] text-[#00201b]', icone: 'support_agent' },
  resolvido: { label: 'Encerrado', cor: 'bg-[#e4e2df] text-[#4c616c]', icone: 'check_circle' },
};

function AtendimentosHistorico({
  carregando,
  atendimentos,
  atendimentoAberto,
  setAtendimentoAberto,
  nomeUsuario,
}: {
  carregando: boolean;
  atendimentos: HandoffComMensagens[];
  atendimentoAberto: number | null;
  setAtendimentoAberto: (id: number | null) => void;
  nomeUsuario: string | undefined;
}) {
  const ativo = atendimentos.find((a) => a.id === atendimentoAberto) || null;
  const initials = (nomeUsuario || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const { t, idioma } = useI18n();
  const locale = idioma === 'en' ? 'en-US' : 'pt-BR';

  return (
    <section>
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-bold text-[#00342d] tracking-tight font-[var(--font-serif)]">
          {t('Atendimentos')}
        </h1>
        <p className="text-[#4c616c] text-base md:text-lg mt-2">
          {t('Histórico de conversas com nossa equipe de suporte.')}
        </p>
      </div>

      {carregando ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#bfc9c4]/10">
          <span className="material-symbols-outlined text-[32px] text-[#4c616c] animate-spin">progress_activity</span>
          <p className="text-[#4c616c] mt-2">{t('Carregando atendimentos...')}</p>
        </div>
      ) : atendimentos.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#bfc9c4]/10">
          <div className="w-16 h-16 rounded-2xl bg-[#f5f3f0] flex items-center justify-center mx-auto mb-4 text-[#4c616c]">
            <span className="material-symbols-outlined text-[36px]">support_agent</span>
          </div>
          <h3 className="text-xl font-bold text-[#1b1c1a] mb-2 font-[var(--font-serif)]">{t('Nenhum atendimento')}</h3>
          <p className="text-[#4c616c]">{t('Você ainda não solicitou atendimento humano. Use o chatbot para iniciar uma conversa.')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/10 shadow-sm overflow-hidden flex" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
          {/* Sidebar */}
          <aside className={`w-full max-w-sm border-r border-[#bfc9c4]/20 flex flex-col bg-white ${atendimentoAberto ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex-1 overflow-y-auto">
              {atendimentos.map((h) => {
                const isActive = atendimentoAberto === h.id;
                const isResolvido = h.status === 'resolvido';
                const d = new Date(h.criado_em);
                const timeStr = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });
                const ultima = h.mensagens.length > 0 ? h.mensagens[h.mensagens.length - 1].conteudo : (h.motivo || t('Solicitação de atendimento'));
                return (
                  <div
                    key={h.id}
                    onClick={() => setAtendimentoAberto(h.id)}
                    className={`p-4 flex gap-3 cursor-pointer transition-colors border-l-4 ${
                      isActive
                        ? 'border-[#00342d] bg-[#eae8e5]/40'
                        : isResolvido
                        ? 'border-transparent opacity-70 hover:opacity-100 hover:bg-[#efeeeb]'
                        : 'border-transparent hover:bg-[#efeeeb]'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isResolvido ? 'bg-[#e4e2df] text-[#707975]' : 'bg-[#cfe6f2] text-[#071e27]'
                      }`}>
                        <span className="material-symbols-outlined">support_agent</span>
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
                        <h3 className="text-sm font-bold text-[#1b1c1a] truncate">#AT-{String(h.id).padStart(4, '0')}</h3>
                        <span className="text-[10px] text-[#707975] font-medium ml-2 shrink-0">{timeStr}</span>
                      </div>
                      <p className="text-xs text-[#707975] truncate">{ultima}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        h.canal === 'web' ? 'bg-[#cfe6f2] text-[#071e27]' : 'bg-[#a0f2e1] text-[#00201b]'
                      }`}>
                        {h.canal === 'web' ? t('Web') : t('TG')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main Area */}
          <section className={`flex-1 flex flex-col bg-[#fbf9f6] ${!atendimentoAberto ? 'hidden md:flex' : 'flex'}`}>
            {!ativo ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-2xl bg-[#f5f3f0] flex items-center justify-center mb-4 text-[#bfc9c4]">
                  <span className="material-symbols-outlined text-[40px]">forum</span>
                </div>
                <h3 className="text-lg font-bold text-[#1b1c1a] font-[var(--font-serif)] mb-1">{t('Selecione um atendimento')}</h3>
                <p className="text-sm text-[#707975] max-w-xs">{t('Escolha um registro na lista ao lado para ver as mensagens trocadas.')}</p>
              </div>
            ) : (
              <>
                <header className="h-20 px-4 md:px-8 flex items-center justify-between border-b border-[#bfc9c4]/10 bg-[#fbf9f6]/80 backdrop-blur-md shrink-0">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setAtendimentoAberto(null)} className="md:hidden text-[#707975] hover:text-[#1b1c1a] transition-colors">
                      <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="w-10 h-10 rounded-full border-2 border-[#00342d]/10 bg-[#cfe6f2] flex items-center justify-center text-[#071e27] font-bold text-sm">
                      <span className="material-symbols-outlined text-[20px]">support_agent</span>
                    </div>
                    <div>
                      <h2 className="font-bold text-[#1b1c1a]">{t('Atendimento')} #AT-{String(ativo.id).padStart(4, '0')}</h2>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${HANDOFF_STATUS_LABELS[ativo.status]?.cor || 'bg-[#e4e2df] text-[#4c616c]'}`}>
                          <span className="material-symbols-outlined text-[12px]">{HANDOFF_STATUS_LABELS[ativo.status]?.icone || 'info'}</span>
                          {t(HANDOFF_STATUS_LABELS[ativo.status]?.label || ativo.status)}
                        </span>
                        <span className="text-[10px] text-[#707975]">
                          {new Date(ativo.criado_em).toLocaleString(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {ativo.nome_atendente && (
                          <span className="text-[10px] text-[#707975]">• {t('Atendente')}: {ativo.nome_atendente}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 flex flex-col">
                  {ativo.mensagens.length === 0 ? (
                    <div className="self-center text-center py-8">
                      <p className="text-[#707975] text-sm">{t('Nenhuma mensagem neste atendimento.')}</p>
                    </div>
                  ) : (
                    <>
                      <div className="self-center">
                        <span className="text-[10px] font-bold text-[#707975] uppercase tracking-[0.2em] bg-[#eae8e5] px-4 py-1 rounded-full">
                          {new Date(ativo.mensagens[0].criado_em).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      {ativo.mensagens.map((msg) => {
                        const isSent = msg.remetente_tipo === 'usuario';
                        return (
                          <div key={msg.id} className={`flex items-end gap-3 max-w-[70%] ${isSent ? 'self-end flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                              isSent ? 'bg-[#00342d] text-white' : 'bg-[#eae8e5] text-[#707975]'
                            }`}>
                              {isSent ? (
                                <span className="text-[11px] font-bold">{initials}</span>
                              ) : (
                                <span className="material-symbols-outlined text-sm">support_agent</span>
                              )}
                            </div>
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
                                  {msg.nome_remetente && !isSent ? `${msg.nome_remetente} • ` : ''}
                                  {new Date(msg.criado_em).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
