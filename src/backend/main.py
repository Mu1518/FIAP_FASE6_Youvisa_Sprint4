import os
import uuid

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr

from config import FRONTEND_URL, JWT_SECRET, JWT_ALGORITHM
from database import init_db, get_connection
from services import gerar_codigo_otp, salvar_otp, verificar_otp, enviar_email_otp, enviar_notificacao_status, enviar_notificacao_documentos_solicitados
from services_ai import (
    AIAnalysisError,
    AIServiceConfigurationError,
    AIValidationError,
    analisar_passaporte_textract,
    comparar_foto_com_passaporte_rekognition,
)
from services_chatbot import gerar_resposta_chatbot, ChatbotConfigError, ChatbotError
from auth import criar_token, verificar_token, verificar_token_funcionario

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

    # Criar solicitações automáticas de documentos obrigatórios (passaporte + foto)
    for tipo_doc, desc in [("passaporte", "Cópia do passaporte válido"), ("foto", "Foto 3x4 recente")]:
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

    # Auto-transição para "em_analise" ao submeter os 2 primeiros documentos obrigatórios
    cur.execute("SELECT status FROM processos WHERE id = %s", (processo_id,))
    status_atual = cur.fetchone()["status"]
    if status_atual == "recebido":
        cur.execute(
            "SELECT COUNT(DISTINCT tipo_documento) FROM documentos WHERE processo_id = %s AND tipo_documento IN ('passaporte', 'foto')",
            (processo_id,),
        )
        tipos_enviados = cur.fetchone()["count"]
        if tipos_enviados >= 2:
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
