const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
// URL direta do backend para chamadas de longa duração (bypassa o proxy do Next.js que tem timeout curto)
const BACKEND_DIRECT_URL = process.env.NEXT_PUBLIC_BACKEND_DIRECT_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { headers, ...rest } = options || {};
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "Erro na requisição");
  }

  return data as T;
}

export function cadastro(nome: string, email: string, telefone: string) {
  return request<{ mensagem: string }>("/cadastro", {
    method: "POST",
    body: JSON.stringify({ nome, email, telefone }),
  });
}

export function verificarCadastro(email: string, codigo: string) {
  return request<{ token: string; usuario: { id: number; nome: string; email: string } }>("/cadastro/verificar", {
    method: "POST",
    body: JSON.stringify({ email, codigo }),
  });
}

export function login(email: string) {
  return request<{ mensagem: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verificarLogin(email: string, codigo: string) {
  return request<{ token: string; usuario: { id: number; nome: string; email: string } }>("/login/verificar", {
    method: "POST",
    body: JSON.stringify({ email, codigo }),
  });
}

export function adminLogin(email: string) {
  return request<{ mensagem: string }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verificarAdminLogin(email: string, codigo: string) {
  return request<{ token: string; funcionario: { id: number; nome: string; email: string } }>("/admin/login/verificar", {
    method: "POST",
    body: JSON.stringify({ email, codigo }),
  });
}

export function buscarProcessosUsuario(token: string) {
  return request<{ processos: Processo[] }>("/dashboard/processos", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function buscarTodosProcessos(token: string) {
  return request<{ processos: Processo[] }>("/admin/dashboard/processos", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface Processo {
  id: number;
  tipo: string;
  status: string;
  descricao: string | null;
  nome_completo: string;
  data_nascimento: string | null;
  passaporte: string | null;
  data_expiracao_passaporte: string | null;
  pais_destino: string | null;
  total_documentos: number;
  total_solicitacoes_pendentes?: number;
  criado_em: string;
  atualizado_em: string;
  usuario_nome: string;
  usuario_email?: string;
}

export interface Documento {
  id: number;
  nome_original: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  tipo_documento: string;
  tamanho: number;
  status: 'pendente_revisao' | 'aprovado' | 'rejeitado';
  feedback: string | null;
  criado_em: string;
}

export interface SolicitacaoDocumento {
  id: number;
  processo_id: number;
  tipo_documento: string;
  descricao: string | null;
  obrigatoria: boolean;
  status: 'pendente' | 'enviado' | 'aprovado' | 'rejeitado';
  documento_id: number | null;
  criado_em: string;
  atualizado_em: string;
  // Dados do documento vinculado (via LEFT JOIN)
  doc_nome_original: string | null;
  doc_tipo_arquivo: string | null;
  doc_tamanho: number | null;
  doc_status: string | null;
  doc_feedback: string | null;
  doc_criado_em: string | null;
}

export interface CriarProcessoPayload {
  tipo: string;
  nome_completo: string;
  data_nascimento: string;
  passaporte: string;
  data_expiracao_passaporte: string;
  pais_destino: string;
  descricao?: string;
}

export interface DadosExtraidosPassaporte {
  nome_completo: string | null;
  data_nascimento: string | null;
  data_expiracao_passaporte: string | null;
  passaporte: string | null;
  mrz_valido: boolean;
  mrz_motivo: string;
}

export interface ExtrairPassaporteResponse {
  dados: DadosExtraidosPassaporte;
  nome_arquivo: string;
  nome_original: string;
  tipo_arquivo: string;
  tamanho: number;
}

export async function extrairDadosPassaporte(token: string, arquivo: File): Promise<ExtrairPassaporteResponse> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);

  const res = await fetch(`${API_URL}/extrair-passaporte`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erro ao extrair dados do passaporte");
  return data as ExtrairPassaporteResponse;
}

export function criarProcesso(token: string, dados: CriarProcessoPayload) {
  return request<{ processo: Processo }>("/processos", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });
}

export async function uploadDocumento(token: string, processoId: number, arquivo: File, tipoDocumento: string, solicitacaoId?: number) {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  formData.append("tipo_documento", tipoDocumento);
  if (solicitacaoId) formData.append("solicitacao_id", String(solicitacaoId));

  const res = await fetch(`${API_URL}/processos/${processoId}/documentos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erro ao enviar documento");
  return data as { documento: Documento };
}

export function buscarDocumentos(token: string, processoId: number) {
  return request<{ documentos: Documento[] }>(`/processos/${processoId}/documentos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function excluirDocumento(token: string, processoId: number, documentoId: number) {
  return request<{ mensagem: string }>(`/processos/${processoId}/documentos/${documentoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Máquina de Estados ---

export interface Transicao {
  id: number;
  processo_id: number;
  status_anterior: string;
  status_novo: string;
  responsavel_id: number;
  responsavel_tipo: string;
  responsavel_nome: string | null;
  observacao: string | null;
  criado_em: string;
}

export function atualizarStatusProcesso(token: string, processoId: number, status: string, observacao?: string) {
  return request<{ processo: Processo; transicao: Transicao }>(`/processos/${processoId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, observacao }),
  });
}

export function buscarHistoricoProcesso(token: string, processoId: number) {
  return request<{ historico: Transicao[] }>(`/processos/${processoId}/historico`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function buscarTransicoesValidas(token: string, processoId: number) {
  return request<{ status_atual: string; transicoes_permitidas: string[] }>(`/processos/${processoId}/transicoes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Documentos Admin ---

export function buscarDocumentosAdmin(token: string, processoId: number) {
  return request<{ documentos: Documento[] }>(`/admin/processos/${processoId}/documentos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getDocumentoDownloadUrl(processoId: number, documentoId: number): string {
  return `${API_URL}/admin/processos/${processoId}/documentos/${documentoId}/download`;
}

export function avaliarDocumento(token: string, processoId: number, documentoId: number, status: string, feedback?: string) {
  return request<{ documento: Documento }>(`/admin/processos/${processoId}/documentos/${documentoId}/avaliar`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, feedback }),
  });
}

export function aprovarDocumentoComIA(token: string, processoId: number, documentoId: number) {
  return fetch(`${API_URL}/admin/processos/${processoId}/documentos/${documentoId}/aprovar-ia`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }).then(async (res) => {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const error = new Error(
        (typeof data === 'object' && data && 'detail' in data && typeof data.detail === 'string')
          ? data.detail
          : 'Erro ao aprovar documento com IA'
      ) as Error & { status?: number; details?: unknown };
      error.status = res.status;
      error.details = data;
      throw error;
    }

    return data as { documento: Documento; origem: 'ia'; regra: 'passaporte_textract' | 'foto_rekognition' };
  });
}

// --- Solicitações de Documentos ---

export function solicitarDocumentos(token: string, processoId: number, documentos: Array<{ tipo_documento: string; descricao?: string; obrigatoria?: boolean }>) {
  return request<{ solicitacoes: SolicitacaoDocumento[] }>(`/admin/processos/${processoId}/solicitacoes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ documentos }),
  });
}

export function buscarSolicitacoes(token: string, processoId: number) {
  return request<{ solicitacoes: SolicitacaoDocumento[] }>(`/processos/${processoId}/solicitacoes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Chatbot IA ---

export interface ChatbotMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface ChatbotResponse {
  resposta: string;
  intencao: string;
  requer_auth: boolean;
  requer_handoff?: boolean;
}

export function enviarMensagemChatbot(
  mensagem: string,
  historico: ChatbotMessage[],
  token?: string | null,
) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return request<ChatbotResponse>("/chatbot/mensagem", {
    method: "POST",
    headers,
    body: JSON.stringify({ mensagem, historico }),
  });
}

export function chatbotLogin(email: string) {
  return request<{ mensagem: string }>("/chatbot/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function chatbotVerificarLogin(email: string, codigo: string) {
  return request<{ token: string; usuario: { id: number; nome: string; email: string } }>(
    "/chatbot/login/verificar",
    {
      method: "POST",
      body: JSON.stringify({ email, codigo }),
    },
  );
}

// --- Telegram Integration ---

export interface TelegramStatus {
  vinculado: boolean;
  telegram_username?: string;
}

export interface TelegramCodigoResponse {
  codigo: string;
  link: string | null;
  bot_username: string;
}

export function gerarCodigoTelegram(token: string) {
  return request<TelegramCodigoResponse>("/telegram/gerar-codigo", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function statusTelegram(token: string) {
  return request<TelegramStatus>("/telegram/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function desvincularTelegram(token: string) {
  return request<{ mensagem: string }>("/telegram/desvincular", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Human Handoff (Admin) ---

export interface Handoff {
  id: number;
  usuario_id: number | null;
  telegram_chat_id: number;
  canal: string;
  motivo: string | null;
  status: string;
  atendido_por: number | null;
  nome_usuario: string | null;
  email_usuario: string | null;
  nome_atendente: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface HandoffMensagem {
  id: number;
  remetente_tipo: string;
  remetente_id: number | null;
  conteudo: string;
  nome_remetente: string | null;
  criado_em: string;
}

export function buscarHandoffs(token: string, statusFiltro?: string) {
  const query = statusFiltro ? `?status_filtro=${statusFiltro}` : "";
  return request<{ handoffs: Handoff[] }>(`/admin/handoffs${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function atualizarHandoff(token: string, handoffId: number, status: string) {
  return request<{ handoff: Handoff }>(`/admin/handoffs/${handoffId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}

export function buscarMensagensHandoff(token: string, handoffId: number) {
  return request<{ mensagens: HandoffMensagem[] }>(`/admin/handoffs/${handoffId}/mensagens`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function enviarMensagemHandoff(token: string, handoffId: number, conteudo: string) {
  return request<{ mensagem_id: number }>(`/admin/handoffs/${handoffId}/mensagens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conteudo }),
  });
}

// --- Web Handoff (User) ---

export function solicitarHandoffWeb(token: string) {
  return request<{ handoff_id: number; status: string }>("/chatbot/handoff", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function buscarStatusHandoffWeb(token: string) {
  return request<{
    ativo: boolean;
    handoff_id?: number;
    status?: string;
    nome_atendente?: string | null;
    mensagens?: HandoffMensagem[];
  }>("/chatbot/handoff/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface HandoffComMensagens extends Handoff {
  mensagens: HandoffMensagem[];
}

export function buscarHistoricoAtendimentos(token: string) {
  return request<{ handoffs: HandoffComMensagens[] }>("/chatbot/handoffs/historico", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function enviarMensagemHandoffWeb(token: string, conteudo: string) {
  return request<{ mensagem_id: number }>("/chatbot/handoff/mensagem", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ conteudo }),
  });
}

// --- Copiloto de Prontidão (Case Readiness) ---

export interface AnaliseCasoItem {
  categoria: string;
  descricao: string;
  status: 'aprovado' | 'reprovado' | 'alerta';
  detalhes: string;
}

export interface AnaliseCaso {
  id: number;
  processo_id: number;
  pontuacao: number;
  itens: AnaliseCasoItem[];
  resumo_ia: string;
  documentos_faltantes: string[];
  alertas: string[];
  analisado_por: number;
  criado_em: string;
}

export async function analisarCaso(token: string, processoId: number): Promise<AnaliseCaso> {
  // Usa URL direta do backend para evitar timeout do proxy Next.js (~30s).
  // O agente IA pode levar 30-60s para concluir a análise.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutos

  try {
    const res = await fetch(`${API_URL}/admin/processos/${processoId}/analisar-caso`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Erro ao analisar caso");
    return data as AnaliseCaso;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error("A análise demorou mais que o esperado. Tente novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function buscarAnaliseCaso(token: string, processoId: number) {
  return request<AnaliseCaso>(`/admin/processos/${processoId}/analise`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// --- Preferências do usuário ---

export function atualizarIdioma(token: string, idioma: 'pt-BR' | 'en-US') {
  return request<{ idioma: string }>("/me/idioma", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ idioma }),
  });
}

// --- Requisitos de Visto ---

export interface RequisitoVisto {
  id: number;
  tipo_visto: string;
  pais_destino: string;
  documentos_obrigatorios: string[];
  validade_minima_passaporte_meses: number;
  regras_adicionais: Record<string, unknown> | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface RequisitoVistoPayload {
  tipo_visto: string;
  pais_destino: string;
  documentos_obrigatorios: string[];
  validade_minima_passaporte_meses: number;
  regras_adicionais?: Record<string, unknown> | null;
  ativo?: boolean;
}

export function buscarRequisitos(token: string) {
  return request<{ requisitos: RequisitoVisto[] }>("/admin/requisitos", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function criarRequisito(token: string, dados: RequisitoVistoPayload) {
  return request<RequisitoVisto>("/admin/requisitos", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });
}

export function atualizarRequisito(token: string, requisitoId: number, dados: RequisitoVistoPayload) {
  return request<RequisitoVisto>(`/admin/requisitos/${requisitoId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });
}

export function excluirRequisito(token: string, requisitoId: number) {
  return request<{ mensagem: string }>(`/admin/requisitos/${requisitoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
