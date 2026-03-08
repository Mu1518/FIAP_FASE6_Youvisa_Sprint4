const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

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
