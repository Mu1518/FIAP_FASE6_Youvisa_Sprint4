import asyncio
import os
import uuid

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr

from config import FRONTEND_URL, JWT_SECRET, JWT_ALGORITHM
from database import init_pool, init_db, get_connection
from services import gerar_codigo_otp, salvar_otp, verificar_otp, enviar_email_otp, enviar_notificacao_status, enviar_notificacao_documentos_solicitados
from services_ai import (
    AIAnalysisError,
    AIServiceConfigurationError,
    AIValidationError,
    analisar_passaporte_textract,
    comparar_foto_com_passaporte_rekognition,
    extrair_dados_passaporte,
)
from services_chatbot import gerar_resposta_chatbot, ChatbotConfigError, ChatbotError
from services_copilot import executar_analise_caso, buscar_ultima_analise
from services_telegram import (
    gerar_codigo_vinculacao, buscar_status_vinculacao, desvincular_conta,
    buscar_handoffs, buscar_handoff_por_id, atualizar_handoff,
    buscar_mensagens_handoff, salvar_mensagem_handoff,
    enviar_notificacao_telegram, buscar_chat_id_por_usuario,
    criar_handoff, buscar_handoff_ativo_por_usuario,
    buscar_handoffs_por_usuario,
)
from telegram_templates import template_handoff_admin_entrou, template_handoff_encerrado
from auth import criar_token, verificar_token, verificar_token_funcionario
from event_bus import publish as sse_publish, subscribe as sse_subscribe, unsubscribe as sse_unsubscribe

optional_bearer = HTTPBearer(auto_error=False)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="YouVisa API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- SSE (Server-Sent Events) ---

def _verificar_token_sse(token: str):
    """Verify JWT from query parameter (EventSource API doesn't support custom headers)."""
    from jose import JWTError, jwt
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


async def _sse_stream(channel: str):
    """Generate SSE event stream for a channel."""
    queue = sse_subscribe(channel)
    try:
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=30.0)
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        sse_unsubscribe(channel, queue)


@app.get("/events/user")
async def sse_user(token: str = Query(...)):
    payload = _verificar_token_sse(token)
    if not payload or payload.get("tipo") == "funcionario":
        raise HTTPException(status_code=401, detail="Token inválido")
    return StreamingResponse(
        _sse_stream(f"user:{payload['id']}"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/events/admin")
async def sse_admin(token: str = Query(...)):
    payload = _verificar_token_sse(token)
    if not payload or payload.get("tipo") != "funcionario":
        raise HTTPException(status_code=401, detail="Token inválido")
    return StreamingResponse(
        _sse_stream("admin"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/events/handoff/{handoff_id}")
async def sse_handoff(handoff_id: int, token: str = Query(...)):
    payload = _verificar_token_sse(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")
    return StreamingResponse(
        _sse_stream(f"handoff:{handoff_id}"),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- Modelos Pydantic ---

class CadastroRequest(BaseModel):
    nome: str
    email: EmailStr
    telefone: str


class VerificarOTPRequest(BaseModel):
    email: EmailStr
    codigo: str


class LoginRequest(BaseModel):
    email: EmailStr


class CriarProcessoRequest(BaseModel):
    tipo: str
    nome_completo: str
    data_nascimento: str
    passaporte: str
    data_expiracao_passaporte: str
    pais_destino: str
    descricao: str | None = None


TIPOS_VALIDOS = ["visto_turista", "visto_estudante", "visto_trabalho", "imigracao", "intercambio"]
TIPOS_DOCUMENTO_VALIDOS = [
    "passaporte", "foto", "comprovante_financeiro", "carta_convite",
    "seguro_viagem", "comprovante_matricula", "contrato_trabalho",
    "comprovante_residencia", "certidao_nascimento", "certidao_casamento",
    "antecedentes_criminais", "exame_medico", "formulario_ds160",
    "comprovante_pagamento_taxa", "outro",
]

# --- Máquina de Estados ---

ESTADOS_VALIDOS = ["recebido", "em_analise", "documentos_pendentes", "em_processamento", "aprovado", "rejeitado", "cancelado"]

TRANSICOES_VALIDAS = {
    "recebido": ["em_analise", "cancelado"],
    "em_analise": ["documentos_pendentes", "em_processamento", "rejeitado", "cancelado"],
    "documentos_pendentes": ["em_analise", "cancelado"],
    "em_processamento": ["aprovado", "rejeitado", "cancelado"],
    "aprovado": [],
    "rejeitado": [],
    "cancelado": [],
}


class AtualizarStatusRequest(BaseModel):
    status: str
    observacao: str | None = None


class AvaliarDocumentoRequest(BaseModel):
    status: str
    feedback: str | None = None


class SolicitacaoDocumentoItem(BaseModel):
    tipo_documento: str
    descricao: str | None = None
    obrigatoria: bool = True


class SolicitarDocumentosRequest(BaseModel):
    documentos: list[SolicitacaoDocumentoItem]


# --- Startup ---

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def startup():
    init_pool()
    init_db()


# --- Rotas de Cadastro ---

@app.post("/cadastro")
def cadastro(dados: CadastroRequest):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id FROM usuarios WHERE email = %s", (dados.email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    cur.execute(
        "INSERT INTO usuarios (nome, email, telefone, ativo) VALUES (%s, %s, %s, FALSE) RETURNING id",
        (dados.nome, dados.email, dados.telefone)
    )
    conn.commit()
    cur.close()
    conn.close()

    codigo = gerar_codigo_otp()
    salvar_otp(dados.email, codigo, "cadastro")
    enviar_email_otp(dados.email, codigo, "Código de verificação - Cadastro YouVisa")

    return {"mensagem": "Código OTP enviado para o e-mail informado"}


@app.post("/cadastro/verificar")
def verificar_cadastro(dados: VerificarOTPRequest):
    if not verificar_otp(dados.email, dados.codigo, "cadastro"):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE usuarios SET ativo = TRUE WHERE email = %s", (dados.email,))
    cur.execute("SELECT id, nome, email, telefone FROM usuarios WHERE email = %s", (dados.email,))
    usuario = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    token = criar_token({"id": usuario["id"], "email": usuario["email"], "nome": usuario["nome"], "tipo": "usuario"})
    return {"token": token, "usuario": dict(usuario)}


# --- Rotas de Login (Usuário) ---

@app.post("/login")
def login(dados: LoginRequest):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM usuarios WHERE email = %s AND ativo = TRUE", (dados.email,))
    usuario = cur.fetchone()
    cur.close()
    conn.close()

    if not usuario:
        raise HTTPException(status_code=404, detail="E-mail não encontrado ou conta não ativada")

    codigo = gerar_codigo_otp()
    salvar_otp(dados.email, codigo, "login")
    enviar_email_otp(dados.email, codigo, "Código de login - YouVisa")

    return {"mensagem": "Código OTP enviado para o e-mail informado"}


@app.post("/login/verificar")
def verificar_login(dados: VerificarOTPRequest):
    if not verificar_otp(dados.email, dados.codigo, "login"):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nome, email, telefone FROM usuarios WHERE email = %s", (dados.email,))
    usuario = cur.fetchone()
    cur.close()
    conn.close()

    token = criar_token({"id": usuario["id"], "email": usuario["email"], "nome": usuario["nome"], "tipo": "usuario"})
    return {"token": token, "usuario": dict(usuario)}


# --- Rotas de Login (Funcionário/Admin) ---

@app.post("/admin/login")
def admin_login(dados: LoginRequest):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM funcionarios WHERE email = %s", (dados.email,))
    funcionario = cur.fetchone()
    cur.close()
    conn.close()

    if not funcionario:
        raise HTTPException(status_code=404, detail="E-mail de funcionário não encontrado")

    codigo = gerar_codigo_otp()
    salvar_otp(dados.email, codigo, "admin_login")
    enviar_email_otp(dados.email, codigo, "Código de acesso admin - YouVisa")

    return {"mensagem": "Código OTP enviado para o e-mail informado"}


@app.post("/admin/login/verificar")
def verificar_admin_login(dados: VerificarOTPRequest):
    if not verificar_otp(dados.email, dados.codigo, "admin_login"):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nome, email FROM funcionarios WHERE email = %s", (dados.email,))
    funcionario = cur.fetchone()
    cur.close()
    conn.close()

    token = criar_token({"id": funcionario["id"], "email": funcionario["email"], "nome": funcionario["nome"], "tipo": "funcionario"})
    return {"token": token, "funcionario": dict(funcionario)}


# --- Rotas de Dashboard (Usuário) ---

@app.get("/dashboard/processos")
def listar_processos_usuario(payload: dict = Depends(verificar_token)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT p.id, p.tipo, p.status, p.descricao, p.nome_completo, p.data_nascimento, p.passaporte, p.data_expiracao_passaporte, p.pais_destino, p.criado_em, p.atualizado_em, u.nome as usuario_nome,
                  (SELECT COUNT(*) FROM documentos d WHERE d.processo_id = p.id) as total_documentos,
                  (SELECT COUNT(*) FROM solicitacoes_documento sd WHERE sd.processo_id = p.id AND sd.status = 'pendente') as total_solicitacoes_pendentes
           FROM processos p
           JOIN usuarios u ON p.usuario_id = u.id
           WHERE p.usuario_id = %s
           ORDER BY p.criado_em DESC""",
        (payload["id"],)
    )
    processos = cur.fetchall()
    cur.close()
    conn.close()
    return {"processos": [dict(p) for p in processos]}


# --- Rotas de Dashboard (Admin/Funcionário) ---

@app.get("/admin/dashboard/processos")
def listar_todos_processos(payload: dict = Depends(verificar_token_funcionario)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT p.id, p.tipo, p.status, p.descricao, p.nome_completo, p.data_nascimento, p.passaporte, p.data_expiracao_passaporte, p.pais_destino, p.criado_em, p.atualizado_em, u.nome as usuario_nome, u.email as usuario_email,
                  (SELECT COUNT(*) FROM documentos d WHERE d.processo_id = p.id) as total_documentos,
                  (SELECT COUNT(*) FROM solicitacoes_documento sd WHERE sd.processo_id = p.id AND sd.status = 'pendente') as total_solicitacoes_pendentes
           FROM processos p
           JOIN usuarios u ON p.usuario_id = u.id
           ORDER BY p.criado_em DESC"""
    )
    processos = cur.fetchall()
    cur.close()
    conn.close()
    return {"processos": [dict(p) for p in processos]}


# --- Rotas de Processos ---

@app.post("/extrair-passaporte")
def extrair_passaporte(
    arquivo: UploadFile = File(...),
    payload: dict = Depends(verificar_token),
):
    extensao = os.path.splitext(arquivo.filename or "")[1]
    nome_arquivo = f"{uuid.uuid4().hex}{extensao}"
    caminho = os.path.join(UPLOAD_DIR, nome_arquivo)

    conteudo = arquivo.file.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)

    try:
        dados = extrair_dados_passaporte(caminho)
    except AIServiceConfigurationError as exc:
        os.remove(caminho)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AIValidationError as exc:
        os.remove(caminho)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AIAnalysisError as exc:
        os.remove(caminho)
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "dados": dados,
        "nome_arquivo": nome_arquivo,
        "nome_original": arquivo.filename,
        "tipo_arquivo": arquivo.content_type,
        "tamanho": len(conteudo),
    }


@app.post("/processos")
def criar_processo(dados: CriarProcessoRequest, payload: dict = Depends(verificar_token)):
    if dados.tipo not in TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Tipos aceitos: {', '.join(TIPOS_VALIDOS)}")

    if not dados.nome_completo or not dados.nome_completo.strip():
        raise HTTPException(status_code=400, detail="Nome completo é obrigatório")
    if not dados.data_nascimento or not dados.data_nascimento.strip():
        raise HTTPException(status_code=400, detail="Data de nascimento é obrigatória")
    if not dados.passaporte or not dados.passaporte.strip():
        raise HTTPException(status_code=400, detail="Número do passaporte é obrigatório")
    if not dados.data_expiracao_passaporte or not dados.data_expiracao_passaporte.strip():
        raise HTTPException(status_code=400, detail="Data de expiração do passaporte é obrigatória")
    if not dados.pais_destino or not dados.pais_destino.strip():
        raise HTTPException(status_code=400, detail="País de destino é obrigatório")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO processos (usuario_id, tipo, status, descricao, nome_completo, data_nascimento, passaporte, data_expiracao_passaporte, pais_destino)
           VALUES (%s, %s, 'recebido', %s, %s, %s, %s, %s, %s)
           RETURNING id, tipo, status, descricao, nome_completo, data_nascimento, passaporte, data_expiracao_passaporte, pais_destino, criado_em, atualizado_em""",
        (payload["id"], dados.tipo, dados.descricao, dados.nome_completo.strip(), dados.data_nascimento, dados.passaporte.strip(), dados.data_expiracao_passaporte, dados.pais_destino.strip())
    )
    processo = cur.fetchone()

    # Criar solicitações automáticas de documentos obrigatórios
    # Busca requisitos configurados para o tipo de visto + país; senão usa padrão (passaporte + foto)
    cur.execute(
        """SELECT documentos_obrigatorios FROM requisitos_visto
           WHERE tipo_visto = %s AND LOWER(pais_destino) = LOWER(%s) AND ativo = TRUE""",
        (dados.tipo, dados.pais_destino.strip()),
    )
    req_row = cur.fetchone()

    DESCRICOES_PADRAO: dict[str, str] = {
        "passaporte": "Cópia do passaporte válido",
        "foto": "Foto 3x4 recente",
        "comprovante_financeiro": "Comprovante de capacidade financeira",
        "carta_convite": "Carta convite do anfitrião",
        "seguro_viagem": "Apólice de seguro viagem",
        "comprovante_matricula": "Comprovante de matrícula na instituição de ensino",
        "contrato_trabalho": "Contrato ou oferta de trabalho",
        "comprovante_residencia": "Comprovante de residência atual",
        "certidao_nascimento": "Certidão de nascimento",
        "certidao_casamento": "Certidão de casamento",
        "antecedentes_criminais": "Certidão de antecedentes criminais",
        "exame_medico": "Laudo de exame médico",
        "formulario_ds160": "Formulário DS-160 preenchido",
        "comprovante_pagamento_taxa": "Comprovante de pagamento da taxa consular",
    }

    docs_obrigatorios: list[str] = req_row["documentos_obrigatorios"] if req_row else ["passaporte", "foto"]

    for tipo_doc in docs_obrigatorios:
        desc = DESCRICOES_PADRAO.get(tipo_doc, tipo_doc.replace("_", " ").title())
        cur.execute(
            """INSERT INTO solicitacoes_documento (processo_id, tipo_documento, descricao, obrigatoria, solicitado_por)
               VALUES (%s, %s, %s, TRUE, NULL)""",
            (processo["id"], tipo_doc, desc)
        )

    conn.commit()
    cur.close()
    conn.close()

    return {"processo": dict(processo)}


@app.post("/processos/{processo_id}/documentos")
def upload_documento(
    processo_id: int,
    arquivo: UploadFile = File(...),
    tipo_documento: str = Form(...),
    solicitacao_id: int | None = Form(None),
    payload: dict = Depends(verificar_token),
):
    if tipo_documento not in TIPOS_DOCUMENTO_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo de documento inválido. Tipos aceitos: {', '.join(TIPOS_DOCUMENTO_VALIDOS)}")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, usuario_id FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    if processo["usuario_id"] != payload["id"]:
        cur.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Validar solicitação se fornecida
    if solicitacao_id:
        cur.execute(
            "SELECT id FROM solicitacoes_documento WHERE id = %s AND processo_id = %s",
            (solicitacao_id, processo_id)
        )
        if not cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail="Solicitação de documento não encontrada para este processo")

    extensao = os.path.splitext(arquivo.filename or "")[1]
    nome_arquivo = f"{uuid.uuid4().hex}{extensao}"
    caminho = os.path.join(UPLOAD_DIR, nome_arquivo)

    conteudo = arquivo.file.read()
    with open(caminho, "wb") as f:
        f.write(conteudo)

    tamanho = len(conteudo)
    cur.execute(
        """INSERT INTO documentos (processo_id, nome_original, nome_arquivo, tipo_arquivo, tipo_documento, tamanho)
           VALUES (%s, %s, %s, %s, %s, %s)
           RETURNING id, nome_original, nome_arquivo, tipo_arquivo, tipo_documento, tamanho, status, feedback, criado_em""",
        (processo_id, arquivo.filename, nome_arquivo, arquivo.content_type, tipo_documento, tamanho)
    )
    documento = cur.fetchone()

    # Vincular à solicitação se fornecida
    if solicitacao_id:
        cur.execute(
            "UPDATE solicitacoes_documento SET documento_id = %s, status = 'enviado', atualizado_em = NOW() WHERE id = %s",
            (documento["id"], solicitacao_id)
        )
    else:
        # Auto-vincular a uma solicitação pendente do mesmo tipo, se existir
        cur.execute(
            """SELECT id FROM solicitacoes_documento
               WHERE processo_id = %s AND tipo_documento = %s AND status = 'pendente' AND documento_id IS NULL
               ORDER BY criado_em ASC LIMIT 1""",
            (processo_id, tipo_documento)
        )
        sol_pendente = cur.fetchone()
        if sol_pendente:
            cur.execute(
                "UPDATE solicitacoes_documento SET documento_id = %s, status = 'enviado', atualizado_em = NOW() WHERE id = %s",
                (documento["id"], sol_pendente["id"])
            )

    # Auto-transição para "em_analise" ao submeter todos os documentos obrigatórios
    cur.execute("SELECT status, tipo, pais_destino FROM processos WHERE id = %s", (processo_id,))
    proc_info = cur.fetchone()
    status_atual = proc_info["status"]
    if status_atual == "recebido":
        # Buscar documentos obrigatórios configurados ou usar padrão
        cur.execute(
            """SELECT documentos_obrigatorios FROM requisitos_visto
               WHERE tipo_visto = %s AND LOWER(pais_destino) = LOWER(%s) AND ativo = TRUE""",
            (proc_info["tipo"], proc_info["pais_destino"]),
        )
        req_row = cur.fetchone()
        docs_obrigatorios = req_row["documentos_obrigatorios"] if req_row else ["passaporte", "foto"]
        total_obrigatorios = len(docs_obrigatorios)

        # Contar quantos tipos obrigatórios distintos já foram enviados
        if docs_obrigatorios:
            placeholders = ",".join(["%s"] * len(docs_obrigatorios))
            cur.execute(
                f"SELECT COUNT(DISTINCT tipo_documento) AS cnt FROM documentos WHERE processo_id = %s AND tipo_documento IN ({placeholders})",
                (processo_id, *docs_obrigatorios),
            )
            tipos_enviados = cur.fetchone()["cnt"]
        else:
            tipos_enviados = 0
            total_obrigatorios = 0

        if total_obrigatorios > 0 and tipos_enviados >= total_obrigatorios:
            cur.execute(
                "UPDATE processos SET status = 'em_analise', atualizado_em = NOW() WHERE id = %s",
                (processo_id,),
            )
            cur.execute(
                """INSERT INTO transicoes_processo (processo_id, status_anterior, status_novo, responsavel_id, responsavel_tipo, observacao)
                   VALUES (%s, 'recebido', 'em_analise', %s, 'usuario', 'Transição automática: documentos obrigatórios enviados')""",
                (processo_id, payload["id"]),
            )
            # Notificação por e-mail
            cur.execute(
                "SELECT u.nome, u.email FROM usuarios u JOIN processos p ON p.usuario_id = u.id WHERE p.id = %s",
                (processo_id,),
            )
            usr = cur.fetchone()
            cur.execute("SELECT tipo FROM processos WHERE id = %s", (processo_id,))
            tipo_proc = cur.fetchone()["tipo"]
            conn.commit()
            enviar_notificacao_status(
                processo_id=processo_id,
                usuario_id=payload["id"],
                email_destino=usr["email"],
                nome_usuario=usr["nome"],
                tipo_processo=tipo_proc,
                status_anterior="recebido",
                status_novo="em_analise",
                observacao="Transição automática: documentos obrigatórios enviados",
            )
        else:
            conn.commit()
    else:
        conn.commit()

    cur.close()
    conn.close()

    # SSE: notificar admin de novo documento
    sse_publish("admin", "documento_enviado", {"processo_id": processo_id})

    return {"documento": dict(documento)}


@app.get("/processos/{processo_id}/documentos")
def listar_documentos(processo_id: int, payload: dict = Depends(verificar_token)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, usuario_id FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    if processo["usuario_id"] != payload["id"]:
        cur.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    cur.execute(
        """SELECT id, nome_original, nome_arquivo, tipo_arquivo, tipo_documento, tamanho, status, feedback, criado_em
           FROM documentos WHERE processo_id = %s ORDER BY criado_em DESC""",
        (processo_id,)
    )
    documentos = cur.fetchall()
    cur.close()
    conn.close()

    return {"documentos": [dict(d) for d in documentos]}


@app.delete("/processos/{processo_id}/documentos/{documento_id}")
def excluir_documento(processo_id: int, documento_id: int, payload: dict = Depends(verificar_token)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, usuario_id FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    if processo["usuario_id"] != payload["id"]:
        cur.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    cur.execute("SELECT nome_arquivo FROM documentos WHERE id = %s AND processo_id = %s", (documento_id, processo_id))
    documento = cur.fetchone()
    if not documento:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    caminho = os.path.join(UPLOAD_DIR, documento["nome_arquivo"])
    if os.path.exists(caminho):
        os.remove(caminho)

    cur.execute("DELETE FROM documentos WHERE id = %s", (documento_id,))
    conn.commit()
    cur.close()
    conn.close()

    return {"mensagem": "Documento excluído com sucesso"}


# --- Rota de Transição de Status (Admin) ---

@app.patch("/processos/{processo_id}/status")
def atualizar_status_processo(
    processo_id: int,
    dados: AtualizarStatusRequest,
    payload: dict = Depends(verificar_token_funcionario),
):
    if dados.status not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Estados aceitos: {', '.join(ESTADOS_VALIDOS)}")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT p.id, p.status, p.tipo, p.usuario_id, u.nome as usuario_nome, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = %s",
        (processo_id,)
    )
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    status_atual = processo["status"]
    novo_status = dados.status

    if novo_status == status_atual:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="O processo já está neste estado")

    transicoes_permitidas = TRANSICOES_VALIDAS.get(status_atual, [])
    if novo_status not in transicoes_permitidas:
        cur.close()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Transição inválida: '{status_atual}' → '{novo_status}'. Transições permitidas: {', '.join(transicoes_permitidas) or 'nenhuma (estado terminal)'}"
        )

    cur.execute(
        "UPDATE processos SET status = %s, atualizado_em = NOW() WHERE id = %s RETURNING id, tipo, status, descricao, nome_completo, criado_em, atualizado_em",
        (novo_status, processo_id)
    )
    processo_atualizado = cur.fetchone()

    cur.execute(
        """INSERT INTO transicoes_processo (processo_id, status_anterior, status_novo, responsavel_id, responsavel_tipo, observacao)
           VALUES (%s, %s, %s, %s, %s, %s)
           RETURNING id, processo_id, status_anterior, status_novo, responsavel_id, responsavel_tipo, observacao, criado_em""",
        (processo_id, status_atual, novo_status, payload["id"], payload["tipo"], dados.observacao)
    )
    transicao = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    # Enviar notificação por e-mail ao cliente (assíncrono em thread separada)
    enviar_notificacao_status(
        processo_id=processo_id,
        usuario_id=processo["usuario_id"],
        email_destino=processo["usuario_email"],
        nome_usuario=processo["usuario_nome"],
        tipo_processo=processo["tipo"],
        status_anterior=status_atual,
        status_novo=novo_status,
        observacao=dados.observacao,
    )

    # SSE: notificar dashboards
    sse_publish(f"user:{processo['usuario_id']}", "processo_atualizado", {"processo_id": processo_id})
    sse_publish("admin", "processo_atualizado", {"processo_id": processo_id})

    return {"processo": dict(processo_atualizado), "transicao": dict(transicao)}


# --- Rota de Histórico de Transições ---

@app.get("/processos/{processo_id}/historico")
def listar_historico_processo(processo_id: int, payload: dict = Depends(verificar_token)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, usuario_id FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    # Usuário só pode ver histórico dos próprios processos; funcionário pode ver qualquer um
    if payload.get("tipo") != "funcionario" and processo["usuario_id"] != payload["id"]:
        cur.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    cur.execute(
        """SELECT t.id, t.processo_id, t.status_anterior, t.status_novo, t.responsavel_id, t.responsavel_tipo, t.observacao, t.criado_em,
                  CASE WHEN t.responsavel_tipo = 'funcionario' THEN f.nome ELSE u.nome END as responsavel_nome
           FROM transicoes_processo t
           LEFT JOIN funcionarios f ON t.responsavel_tipo = 'funcionario' AND t.responsavel_id = f.id
           LEFT JOIN usuarios u ON t.responsavel_tipo = 'usuario' AND t.responsavel_id = u.id
           WHERE t.processo_id = %s
           ORDER BY t.criado_em ASC""",
        (processo_id,)
    )
    historico = cur.fetchall()
    cur.close()
    conn.close()

    return {"historico": [dict(h) for h in historico]}


# --- Rota de Transições Válidas ---

@app.get("/processos/{processo_id}/transicoes")
def listar_transicoes_validas(processo_id: int, payload: dict = Depends(verificar_token_funcionario)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, status FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    cur.close()
    conn.close()

    status_atual = processo["status"]
    transicoes = TRANSICOES_VALIDAS.get(status_atual, [])

    return {"status_atual": status_atual, "transicoes_permitidas": transicoes}


# --- Rotas de Documentos (Admin) ---

@app.get("/admin/processos/{processo_id}/documentos")
def listar_documentos_admin(processo_id: int, payload: dict = Depends(verificar_token_funcionario)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id FROM processos WHERE id = %s", (processo_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    cur.execute(
        """SELECT id, nome_original, nome_arquivo, tipo_arquivo, tipo_documento, tamanho, status, feedback, revisado_por, revisado_em, criado_em
           FROM documentos WHERE processo_id = %s ORDER BY criado_em DESC""",
        (processo_id,)
    )
    documentos = cur.fetchall()
    cur.close()
    conn.close()

    return {"documentos": [dict(d) for d in documentos]}


@app.get("/admin/processos/{processo_id}/documentos/{documento_id}/download")
def download_documento_admin(processo_id: int, documento_id: int, payload: dict = Depends(verificar_token_funcionario)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT nome_original, nome_arquivo, tipo_arquivo FROM documentos WHERE id = %s AND processo_id = %s",
        (documento_id, processo_id)
    )
    doc = cur.fetchone()
    cur.close()
    conn.close()

    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    caminho = os.path.join(UPLOAD_DIR, doc["nome_arquivo"])
    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor")

    return FileResponse(caminho, media_type=doc["tipo_arquivo"], filename=doc["nome_original"])


@app.patch("/admin/processos/{processo_id}/documentos/{documento_id}/avaliar")
def avaliar_documento(
    processo_id: int,
    documento_id: int,
    dados: AvaliarDocumentoRequest,
    payload: dict = Depends(verificar_token_funcionario),
):
    if dados.status not in ("aprovado", "rejeitado"):
        raise HTTPException(status_code=400, detail="Status inválido. Use 'aprovado' ou 'rejeitado'")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM documentos WHERE id = %s AND processo_id = %s",
        (documento_id, processo_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    cur.execute(
        """UPDATE documentos SET status = %s, feedback = %s, revisado_por = %s, revisado_em = NOW()
           WHERE id = %s
           RETURNING id, nome_original, tipo_documento, status, feedback, revisado_em""",
        (dados.status, dados.feedback, payload["id"], documento_id)
    )
    documento = cur.fetchone()

    # Atualizar solicitação vinculada, se existir
    cur.execute(
        "UPDATE solicitacoes_documento SET status = %s, atualizado_em = NOW() WHERE documento_id = %s",
        (dados.status, documento_id)
    )

    conn.commit()
    cur.close()
    conn.close()

    # SSE: notificar dashboards
    sse_publish("admin", "documento_avaliado", {"processo_id": processo_id})

    return {"documento": dict(documento)}


@app.post("/admin/processos/{processo_id}/documentos/{documento_id}/aprovar-ia")
def aprovar_documento_com_ia(
    processo_id: int,
    documento_id: int,
    payload: dict = Depends(verificar_token_funcionario),
):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """SELECT d.id, d.nome_original, d.nome_arquivo, d.tipo_documento, d.status,
                  p.nome_completo, p.data_nascimento, p.data_expiracao_passaporte
           FROM documentos d
           JOIN processos p ON p.id = d.processo_id
           WHERE d.id = %s AND d.processo_id = %s""",
        (documento_id, processo_id),
    )
    documento = cur.fetchone()
    if not documento:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Documento não encontrado")

    tipo_documento = documento["tipo_documento"]
    if tipo_documento not in ("passaporte", "foto"):
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Aprovação com IA disponível apenas para Passaporte e Foto")

    caminho_documento = os.path.join(UPLOAD_DIR, documento["nome_arquivo"])

    try:
        if tipo_documento == "passaporte":
            resultado = analisar_passaporte_textract(
                caminho_arquivo=caminho_documento,
                nome_esperado=documento["nome_completo"],
                data_nascimento_esperada=documento["data_nascimento"],
                data_validade_esperada=documento["data_expiracao_passaporte"],
            )
        else:
            cur.execute(
                """SELECT nome_arquivo FROM documentos
                   WHERE processo_id = %s AND tipo_documento = 'passaporte' AND id <> %s
                   ORDER BY criado_em DESC LIMIT 1""",
                (processo_id, documento_id),
            )
            passaporte_ref = cur.fetchone()
            if not passaporte_ref:
                raise HTTPException(
                    status_code=409,
                    detail="Envie um documento de Passaporte antes de aprovar Foto com IA",
                )

            caminho_passaporte = os.path.join(UPLOAD_DIR, passaporte_ref["nome_arquivo"])
            resultado = comparar_foto_com_passaporte_rekognition(
                caminho_foto=caminho_documento,
                caminho_passaporte=caminho_passaporte,
            )
    except AIServiceConfigurationError as exc:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except AIValidationError as exc:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except AIAnalysisError as exc:
        cur.close()
        conn.close()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    novo_status = "aprovado" if resultado["aprovado"] else "rejeitado"
    feedback = resultado["mensagem"]

    cur.execute(
        """UPDATE documentos SET status = %s, feedback = %s, revisado_por = %s, revisado_em = NOW()
           WHERE id = %s
           RETURNING id, nome_original, tipo_documento, status, feedback, revisado_em""",
        (novo_status, feedback, payload["id"], documento_id),
    )
    documento_atualizado = cur.fetchone()

    cur.execute(
        "UPDATE solicitacoes_documento SET status = %s, atualizado_em = NOW() WHERE documento_id = %s",
        (novo_status, documento_id),
    )

    conn.commit()
    cur.close()
    conn.close()

    # SSE: notificar dashboards
    sse_publish("admin", "documento_avaliado", {"processo_id": processo_id})

    return {
        "documento": dict(documento_atualizado),
        "origem": "ia",
        "regra": "passaporte_textract" if tipo_documento == "passaporte" else "foto_rekognition",
    }


# --- Rotas de Solicitações de Documentos ---

@app.post("/admin/processos/{processo_id}/solicitacoes")
def solicitar_documentos(
    processo_id: int,
    dados: SolicitarDocumentosRequest,
    payload: dict = Depends(verificar_token_funcionario),
):
    if not dados.documentos:
        raise HTTPException(status_code=400, detail="Informe pelo menos um documento")

    for item in dados.documentos:
        if item.tipo_documento not in TIPOS_DOCUMENTO_VALIDOS:
            raise HTTPException(status_code=400, detail=f"Tipo de documento inválido: {item.tipo_documento}")

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT p.id, p.tipo, p.usuario_id, u.nome as usuario_nome, u.email as usuario_email FROM processos p JOIN usuarios u ON p.usuario_id = u.id WHERE p.id = %s",
        (processo_id,)
    )
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    solicitacoes = []
    for item in dados.documentos:
        cur.execute(
            """INSERT INTO solicitacoes_documento (processo_id, tipo_documento, descricao, obrigatoria, solicitado_por)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, processo_id, tipo_documento, descricao, obrigatoria, status, documento_id, criado_em""",
            (processo_id, item.tipo_documento, item.descricao, item.obrigatoria, payload["id"])
        )
        solicitacoes.append(dict(cur.fetchone()))

    conn.commit()
    cur.close()
    conn.close()

    # Enviar notificação por e-mail ao cliente
    enviar_notificacao_documentos_solicitados(
        processo_id=processo_id,
        usuario_id=processo["usuario_id"],
        email_destino=processo["usuario_email"],
        nome_usuario=processo["usuario_nome"],
        tipo_processo=processo["tipo"],
        documentos_solicitados=[{"tipo_documento": s["tipo_documento"], "descricao": s["descricao"]} for s in solicitacoes],
    )

    # SSE: notificar usuario
    sse_publish(f"user:{processo['usuario_id']}", "documentos_solicitados", {"processo_id": processo_id})

    return {"solicitacoes": solicitacoes}


@app.get("/processos/{processo_id}/solicitacoes")
def listar_solicitacoes(processo_id: int, payload: dict = Depends(verificar_token)):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, usuario_id FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    # Usuário só pode ver solicitações dos próprios processos; funcionário pode ver qualquer um
    if payload.get("tipo") != "funcionario" and processo["usuario_id"] != payload["id"]:
        cur.close()
        conn.close()
        raise HTTPException(status_code=403, detail="Acesso negado")

    cur.execute(
        """SELECT sd.id, sd.processo_id, sd.tipo_documento, sd.descricao, sd.obrigatoria, sd.status, sd.documento_id, sd.criado_em, sd.atualizado_em,
                  d.nome_original as doc_nome_original, d.tipo_arquivo as doc_tipo_arquivo, d.tamanho as doc_tamanho, d.status as doc_status, d.feedback as doc_feedback, d.criado_em as doc_criado_em
           FROM solicitacoes_documento sd
           LEFT JOIN documentos d ON sd.documento_id = d.id
           WHERE sd.processo_id = %s ORDER BY sd.criado_em ASC""",
        (processo_id,)
    )
    solicitacoes = cur.fetchall()
    cur.close()
    conn.close()

    return {"solicitacoes": [dict(s) for s in solicitacoes]}


# --- Rota de Perfil ---

@app.get("/me")
def perfil(payload: dict = Depends(verificar_token)):
    return {"usuario": payload}


class IdiomaRequest(BaseModel):
    idioma: str


@app.patch("/me/idioma")
def atualizar_idioma(dados: IdiomaRequest, payload: dict = Depends(verificar_token)):
    if dados.idioma not in ("pt-BR", "en-US"):
        raise HTTPException(status_code=400, detail="Idioma inválido. Use 'pt-BR' ou 'en-US'.")
    if payload.get("tipo") != "usuario":
        raise HTTPException(status_code=403, detail="Somente usuários podem atualizar idioma.")
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE usuarios SET idioma = %s WHERE id = %s", (dados.idioma, payload["id"]))
        conn.commit()
    return {"idioma": dados.idioma}


# --- Chatbot IA ---

class ChatbotMensagemRequest(BaseModel):
    mensagem: str
    historico: list[dict] = []


class ChatbotLoginRequest(BaseModel):
    email: EmailStr


class ChatbotVerificarOTPRequest(BaseModel):
    email: EmailStr
    codigo: str


@app.post("/chatbot/mensagem")
def chatbot_mensagem(
    dados: ChatbotMensagemRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
):
    usuario_id = None
    nome_usuario = None

    if credentials:
        try:
            from jose import jwt as jose_jwt
            payload = jose_jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            usuario_id = payload.get("id")
            nome_usuario = payload.get("nome")
        except Exception:
            pass

    try:
        resultado = gerar_resposta_chatbot(
            mensagem=dados.mensagem,
            historico_conversa=dados.historico,
            usuario_id=usuario_id,
            nome_usuario=nome_usuario,
        )
        return resultado
    except ChatbotConfigError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar mensagem: {str(e)}")


@app.post("/chatbot/login")
def chatbot_login(dados: ChatbotLoginRequest):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM usuarios WHERE email = %s AND ativo = TRUE", (dados.email,))
    usuario = cur.fetchone()
    cur.close()
    conn.close()

    if not usuario:
        raise HTTPException(status_code=404, detail="E-mail não encontrado ou conta não ativada")

    codigo = gerar_codigo_otp()
    salvar_otp(dados.email, codigo, "chatbot_login")
    enviar_email_otp(dados.email, codigo, "Código de verificação - Chatbot YouVisa")

    return {"mensagem": "Código enviado para o e-mail informado"}


@app.post("/chatbot/login/verificar")
def chatbot_verificar_login(dados: ChatbotVerificarOTPRequest):
    if not verificar_otp(dados.email, dados.codigo, "chatbot_login"):
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nome, email, telefone FROM usuarios WHERE email = %s", (dados.email,))
    usuario = cur.fetchone()
    cur.close()
    conn.close()

    token = criar_token({"id": usuario["id"], "email": usuario["email"], "nome": usuario["nome"], "tipo": "usuario"})
    return {"token": token, "usuario": dict(usuario)}


# --- Telegram Integration ---

from config import TELEGRAM_BOT_USERNAME


@app.post("/telegram/gerar-codigo")
def telegram_gerar_codigo(payload: dict = Depends(verificar_token)):
    codigo = gerar_codigo_vinculacao(payload["id"])
    bot_username = TELEGRAM_BOT_USERNAME
    link = f"https://t.me/{bot_username}?start={codigo}" if bot_username else None
    return {"codigo": codigo, "link": link, "bot_username": bot_username}


@app.get("/telegram/status")
def telegram_status(payload: dict = Depends(verificar_token)):
    return buscar_status_vinculacao(payload["id"])


@app.delete("/telegram/desvincular")
def telegram_desvincular(payload: dict = Depends(verificar_token)):
    removido = desvincular_conta(payload["id"])
    if not removido:
        raise HTTPException(status_code=404, detail="Nenhuma conta Telegram conectada")
    return {"mensagem": "Conta Telegram desconectada com sucesso"}


# --- Human Handoff (Web User) ---


class ChatbotHandoffMensagemRequest(BaseModel):
    conteudo: str


@app.post("/chatbot/handoff")
def chatbot_solicitar_handoff(payload: dict = Depends(verificar_token)):
    """Cria solicitação de handoff via web."""
    handoff = buscar_handoff_ativo_por_usuario(payload["id"])
    if handoff:
        return {"handoff_id": handoff["id"], "status": handoff["status"]}

    handoff_id = criar_handoff(
        usuario_id=payload["id"],
        telegram_chat_id=None,
        motivo="Solicitação via chatbot web",
        canal="web",
    )

    # SSE: notificar admin de novo handoff
    sse_publish("admin", "novo_handoff", {"handoff_id": handoff_id})

    return {"handoff_id": handoff_id, "status": "pendente"}


@app.get("/chatbot/handoff/status")
def chatbot_handoff_status(payload: dict = Depends(verificar_token)):
    """Verifica se há handoff ativo e retorna mensagens."""
    handoff = buscar_handoff_ativo_por_usuario(payload["id"])
    if not handoff:
        return {"ativo": False}

    mensagens = buscar_mensagens_handoff(handoff["id"])
    return {
        "ativo": True,
        "handoff_id": handoff["id"],
        "status": handoff["status"],
        "nome_atendente": handoff.get("nome_atendente"),
        "mensagens": mensagens,
    }


@app.post("/chatbot/handoff/mensagem")
def chatbot_handoff_enviar_mensagem(
    dados: ChatbotHandoffMensagemRequest,
    payload: dict = Depends(verificar_token),
):
    """Usuário envia mensagem durante handoff ativo."""
    handoff = buscar_handoff_ativo_por_usuario(payload["id"])
    if not handoff:
        raise HTTPException(status_code=400, detail="Nenhum atendimento ativo")

    msg_id = salvar_mensagem_handoff(handoff["id"], "usuario", payload["id"], dados.conteudo)

    # SSE: notificar chat do handoff
    sse_publish(f"handoff:{handoff['id']}", "nova_mensagem", {"handoff_id": handoff["id"]})

    return {"mensagem_id": msg_id}


@app.get("/chatbot/handoffs/historico")
def chatbot_handoffs_historico(payload: dict = Depends(verificar_token)):
    """Lista histórico de atendimentos do usuário logado, com mensagens."""
    handoffs = buscar_handoffs_por_usuario(payload["id"])
    resultado = []
    for h in handoffs:
        mensagens = buscar_mensagens_handoff(h["id"])
        resultado.append({**h, "mensagens": mensagens})
    return {"handoffs": resultado}


# --- Human Handoff (Admin) ---

class HandoffAtualizarRequest(BaseModel):
    status: str


class HandoffMensagemRequest(BaseModel):
    conteudo: str


@app.get("/admin/handoffs")
def listar_handoffs(
    status_filtro: str | None = None,
    payload: dict = Depends(verificar_token_funcionario),
):
    return {"handoffs": buscar_handoffs(status_filtro)}


@app.patch("/admin/handoffs/{handoff_id}")
def atualizar_handoff_route(
    handoff_id: int,
    dados: HandoffAtualizarRequest,
    payload: dict = Depends(verificar_token_funcionario),
):
    if dados.status not in ("pendente", "em_atendimento", "resolvido"):
        raise HTTPException(status_code=400, detail="Status inválido")

    handoff = buscar_handoff_por_id(handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado")

    # Guardar status anterior para evitar notificação duplicada
    status_anterior = handoff["status"]

    # Se já está no status solicitado, retornar sem reenviar notificação
    if status_anterior == dados.status:
        return {"handoff": handoff}

    atendido_por = payload["id"] if dados.status == "em_atendimento" else None
    resultado = atualizar_handoff(handoff_id, dados.status, atendido_por)

    # Notificar usuário via Telegram (apenas se status realmente mudou)
    if handoff["telegram_chat_id"]:
        if dados.status == "em_atendimento" and status_anterior != "em_atendimento":
            enviar_notificacao_telegram(
                handoff["telegram_chat_id"],
                template_handoff_admin_entrou(payload["nome"]),
            )
        elif dados.status == "resolvido" and status_anterior != "resolvido":
            enviar_notificacao_telegram(
                handoff["telegram_chat_id"],
                template_handoff_encerrado(),
            )

    # SSE: notificar dashboards
    sse_publish("admin", "handoff_atualizado", {"handoff_id": handoff_id})
    sse_publish(f"handoff:{handoff_id}", "handoff_atualizado", {"handoff_id": handoff_id})

    return {"handoff": resultado}


@app.get("/admin/handoffs/{handoff_id}/mensagens")
def listar_mensagens_handoff(
    handoff_id: int,
    payload: dict = Depends(verificar_token_funcionario),
):
    handoff = buscar_handoff_por_id(handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado")
    return {"mensagens": buscar_mensagens_handoff(handoff_id)}


@app.post("/admin/handoffs/{handoff_id}/mensagens")
def enviar_mensagem_handoff_route(
    handoff_id: int,
    dados: HandoffMensagemRequest,
    payload: dict = Depends(verificar_token_funcionario),
):
    handoff = buscar_handoff_por_id(handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail="Handoff não encontrado")
    if handoff["status"] not in ("pendente", "em_atendimento"):
        raise HTTPException(status_code=400, detail="Handoff já encerrado")

    # Se ainda pendente, marcar como em_atendimento
    if handoff["status"] == "pendente":
        atualizar_handoff(handoff_id, "em_atendimento", payload["id"])
        if handoff["telegram_chat_id"]:
            enviar_notificacao_telegram(
                handoff["telegram_chat_id"],
                template_handoff_admin_entrou(payload["nome"]),
            )

    msg_id = salvar_mensagem_handoff(handoff_id, "funcionario", payload["id"], dados.conteudo)

    # Enviar via Telegram ao usuário
    if handoff["telegram_chat_id"]:
        enviar_notificacao_telegram(
            handoff["telegram_chat_id"],
            f"👤 *Atendente:*\n{dados.conteudo}",
        )

    # SSE: notificar chat do handoff
    sse_publish(f"handoff:{handoff_id}", "nova_mensagem", {"handoff_id": handoff_id})

    return {"mensagem_id": msg_id}


# --- Copiloto de Prontidão (Case Readiness) ---

@app.post("/admin/processos/{processo_id}/analisar-caso")
def analisar_caso(processo_id: int, payload: dict = Depends(verificar_token_funcionario)):
    """Executa análise completa de prontidão de um caso usando IA."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM processos WHERE id = %s", (processo_id,))
    if not cur.fetchone():
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    cur.close()
    conn.close()

    try:
        resultado = executar_analise_caso(processo_id, payload["id"])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na análise do caso: {str(e)}")

    # Auto-notificar usuário se pontuação baixa
    if resultado["pontuacao"] < 70:
        try:
            conn2 = get_connection()
            cur2 = conn2.cursor()
            cur2.execute(
                """SELECT p.usuario_id, u.email, u.nome, p.tipo
                   FROM processos p JOIN usuarios u ON p.usuario_id = u.id
                   WHERE p.id = %s""",
                (processo_id,),
            )
            info = cur2.fetchone()
            cur2.close()
            conn2.close()

            if info:
                from services import enviar_notificacao_analise_caso
                enviar_notificacao_analise_caso(
                    processo_id=processo_id,
                    usuario_id=info["usuario_id"],
                    email_destino=info["email"],
                    nome_usuario=info["nome"],
                    tipo_processo=info["tipo"],
                    pontuacao=resultado["pontuacao"],
                    resumo=resultado["resumo_ia"],
                    documentos_faltantes=resultado["documentos_faltantes"],
                )
        except Exception as e:
            print(f"[COPILOT] Erro ao enviar notificação: {e}")

    return resultado


@app.get("/admin/processos/{processo_id}/analise")
def buscar_analise_admin(processo_id: int, payload: dict = Depends(verificar_token_funcionario)):
    """Retorna a análise mais recente de um processo (admin)."""
    analise = buscar_ultima_analise(processo_id)
    if not analise:
        raise HTTPException(status_code=404, detail="Nenhuma análise encontrada para este processo")
    return analise


@app.get("/processos/{processo_id}/analise")
def buscar_analise_usuario(processo_id: int, payload: dict = Depends(verificar_token)):
    """Retorna a análise mais recente de um processo (usuário — somente próprio processo)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT usuario_id FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    cur.close()
    conn.close()

    if not processo:
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    if processo["usuario_id"] != payload["id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")

    analise = buscar_ultima_analise(processo_id)
    if not analise:
        raise HTTPException(status_code=404, detail="Nenhuma análise encontrada para este processo")
    return analise


# --- Requisitos de Visto (Admin CRUD) ---

TIPOS_VALIDOS = ["visto_turista", "visto_estudante", "visto_trabalho", "imigracao", "intercambio"]

TIPOS_DOCUMENTO_VALIDOS = [
    "passaporte", "foto", "comprovante_financeiro", "carta_convite",
    "seguro_viagem", "comprovante_matricula", "contrato_trabalho",
    "comprovante_residencia", "certidao_nascimento", "certidao_casamento",
    "antecedentes_criminais", "exame_medico", "formulario_ds160",
    "comprovante_pagamento_taxa", "outro",
]


class RequisitoVistoRequest(BaseModel):
    tipo_visto: str
    pais_destino: str
    documentos_obrigatorios: list[str]
    validade_minima_passaporte_meses: int = 6
    regras_adicionais: dict | None = None
    ativo: bool = True


@app.get("/admin/requisitos")
def listar_requisitos(payload: dict = Depends(verificar_token_funcionario)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM requisitos_visto ORDER BY tipo_visto, pais_destino")
    requisitos = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"requisitos": requisitos}


@app.post("/admin/requisitos")
def criar_requisito(dados: RequisitoVistoRequest, payload: dict = Depends(verificar_token_funcionario)):
    if dados.tipo_visto not in TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo de visto inválido. Válidos: {', '.join(TIPOS_VALIDOS)}")

    for doc in dados.documentos_obrigatorios:
        if doc not in TIPOS_DOCUMENTO_VALIDOS:
            raise HTTPException(status_code=400, detail=f"Tipo de documento inválido: {doc}")

    conn = get_connection()
    cur = conn.cursor()

    import json as _json
    try:
        cur.execute(
            """INSERT INTO requisitos_visto (tipo_visto, pais_destino, documentos_obrigatorios,
                                             validade_minima_passaporte_meses, regras_adicionais, ativo)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
            (
                dados.tipo_visto, dados.pais_destino,
                _json.dumps(dados.documentos_obrigatorios),
                dados.validade_minima_passaporte_meses,
                _json.dumps(dados.regras_adicionais or {}),
                dados.ativo,
            ),
        )
        requisito = dict(cur.fetchone())
        conn.commit()
    except Exception as e:
        conn.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Já existe um requisito para este tipo de visto e país")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

    return requisito


@app.put("/admin/requisitos/{requisito_id}")
def atualizar_requisito(requisito_id: int, dados: RequisitoVistoRequest, payload: dict = Depends(verificar_token_funcionario)):
    if dados.tipo_visto not in TIPOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Tipo de visto inválido. Válidos: {', '.join(TIPOS_VALIDOS)}")

    for doc in dados.documentos_obrigatorios:
        if doc not in TIPOS_DOCUMENTO_VALIDOS:
            raise HTTPException(status_code=400, detail=f"Tipo de documento inválido: {doc}")

    conn = get_connection()
    cur = conn.cursor()

    import json as _json
    cur.execute(
        """UPDATE requisitos_visto SET tipo_visto = %s, pais_destino = %s,
                  documentos_obrigatorios = %s, validade_minima_passaporte_meses = %s,
                  regras_adicionais = %s, ativo = %s, atualizado_em = NOW()
           WHERE id = %s RETURNING *""",
        (
            dados.tipo_visto, dados.pais_destino,
            _json.dumps(dados.documentos_obrigatorios),
            dados.validade_minima_passaporte_meses,
            _json.dumps(dados.regras_adicionais or {}),
            dados.ativo, requisito_id,
        ),
    )
    requisito = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if not requisito:
        raise HTTPException(status_code=404, detail="Requisito não encontrado")
    return dict(requisito)


@app.delete("/admin/requisitos/{requisito_id}")
def excluir_requisito(requisito_id: int, payload: dict = Depends(verificar_token_funcionario)):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM requisitos_visto WHERE id = %s RETURNING id", (requisito_id,))
    deleted = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Requisito não encontrado")
    return {"mensagem": "Requisito excluído com sucesso"}
