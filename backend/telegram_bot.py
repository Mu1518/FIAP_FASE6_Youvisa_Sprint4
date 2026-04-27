"""
YouVisa Telegram Bot — entry point separado.
Executar: python telegram_bot.py
"""

import os
import uuid
import logging

from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove, KeyboardButton
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

from config import TELEGRAM_BOT_TOKEN
from database import init_pool, init_db, get_connection
from services_telegram import (
    vincular_conta,
    desvincular_por_chat_id,
    buscar_usuario_por_chat_id,
    atualizar_username_telegram,
    buscar_handoff_ativo_por_chat,
    salvar_mensagem_handoff,
    criar_handoff,
    salvar_estado_conversa,
    buscar_estado_conversa,
    limpar_estado_conversa,
)
from services_chatbot import (
    gerar_resposta_chatbot,
    buscar_processos_usuario,
    buscar_documentos_pendentes,
)
from telegram_templates import (
    template_boas_vindas,
    template_ajuda,
    template_nao_vinculado,
    template_status_processos,
    template_documentos_pendentes,
    template_upload_confirmacao,
    template_handoff_criado,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

TIPOS_DOCUMENTO_VALIDOS = [
    "passaporte", "foto", "comprovante_financeiro", "carta_convite",
    "seguro_viagem", "comprovante_matricula", "contrato_trabalho",
    "comprovante_residencia", "certidao_nascimento", "certidao_casamento",
    "antecedentes_criminais", "exame_medico", "formulario_ds160",
    "comprovante_pagamento_taxa", "outro",
]

# Histórico de conversa por chat_id (em memória, efêmero)
historicos: dict[int, list[dict]] = {}
MAX_HISTORICO = 20


def get_historico(chat_id: int) -> list[dict]:
    return historicos.get(chat_id, [])


def add_historico(chat_id: int, role: str, text: str):
    if chat_id not in historicos:
        historicos[chat_id] = []
    historicos[chat_id].append({"role": role, "parts": [{"text": text}]})
    if len(historicos[chat_id]) > MAX_HISTORICO:
        historicos[chat_id] = historicos[chat_id][-MAX_HISTORICO:]


# --- Comandos ---

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler /start — boas-vindas + conexão via deep link."""
    chat_id = update.effective_chat.id
    username = update.effective_user.username

    # Verificar deep link (código de conexão)
    if context.args:
        codigo = context.args[0]
        usuario = vincular_conta(codigo, chat_id, username)
        if usuario:
            await update.message.reply_text(
                template_boas_vindas(True, usuario["nome"]),
                parse_mode="Markdown",
            )
        else:
            # Código inválido/expirado — mas talvez já esteja conectado
            # (iPhone pode enviar /start duas vezes ao escanear QR code)
            usuario_existente = buscar_usuario_por_chat_id(chat_id)
            if usuario_existente:
                # Já conectado, ignorar silenciosamente (evita mensagem duplicada)
                logger.info(f"Duplicate /start ignored for already-linked chat_id={chat_id}")
                return
            await update.message.reply_text(
                "❌ Código de conexão inválido ou expirado.\n\n"
                "Gere um novo código no painel do YouVisa e tente novamente.",
            )
        return

    # Sem deep link — verificar se já está conectado
    usuario = buscar_usuario_por_chat_id(chat_id)
    if usuario:
        await update.message.reply_text(
            template_boas_vindas(True, usuario["nome"]),
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(
            template_boas_vindas(False),
            parse_mode="Markdown",
        )


async def cmd_ajuda(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(template_ajuda(), parse_mode="Markdown")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    usuario = buscar_usuario_por_chat_id(chat_id)
    if not usuario:
        await update.message.reply_text(template_nao_vinculado())
        return

    processos = buscar_processos_usuario(usuario["id"])
    await update.message.reply_text(
        template_status_processos(processos),
        parse_mode="Markdown",
    )


async def cmd_documentos(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    usuario = buscar_usuario_por_chat_id(chat_id)
    if not usuario:
        await update.message.reply_text(template_nao_vinculado())
        return

    docs = buscar_documentos_pendentes(usuario["id"])
    await update.message.reply_text(
        template_documentos_pendentes(docs),
        parse_mode="Markdown",
    )


async def cmd_enviar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Inicia fluxo de upload de documento."""
    chat_id = update.effective_chat.id
    usuario = buscar_usuario_por_chat_id(chat_id)
    if not usuario:
        await update.message.reply_text(template_nao_vinculado())
        return

    processos = buscar_processos_usuario(usuario["id"])
    ativos = [p for p in processos if p["status"] not in ("aprovado", "rejeitado", "cancelado")]
    if not ativos:
        await update.message.reply_text("📎 Você não possui processos ativos para enviar documentos.")
        return

    # Listar processos para seleção
    linhas = ["📎 *Selecione o processo:*\n"]
    botoes = []
    for i, p in enumerate(ativos, 1):
        from services import TIPO_VISTO_LABELS
        label_tipo = TIPO_VISTO_LABELS.get(p["tipo"], p["tipo"])
        linhas.append(f"{i}. Processo #{p['id']} — {label_tipo} ({p.get('pais_destino', '')})")
        botoes.append([KeyboardButton(str(i))])

    botoes.append([KeyboardButton("Cancelar")])

    salvar_estado_conversa(chat_id, "escolher_processo", {
        "processos": [{"id": p["id"], "tipo": p["tipo"]} for p in ativos],
        "usuario_id": usuario["id"],
    })

    await update.message.reply_text(
        "\n".join(linhas),
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardMarkup(botoes, one_time_keyboard=True, resize_keyboard=True),
    )


async def cmd_atendente(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Solicita atendimento humano."""
    chat_id = update.effective_chat.id
    usuario = buscar_usuario_por_chat_id(chat_id)

    # Verificar se já tem handoff ativo
    handoff = buscar_handoff_ativo_por_chat(chat_id)
    if handoff:
        await update.message.reply_text(
            "👤 Você já possui um atendimento em andamento. "
            "Suas mensagens estão sendo encaminhadas ao atendente."
        )
        return

    usuario_id = usuario["id"] if usuario else None
    criar_handoff(usuario_id, chat_id, "Solicitado pelo usuário via /atendente")
    await update.message.reply_text(template_handoff_criado(), parse_mode="Markdown")


async def cmd_desvincular(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    removido = desvincular_por_chat_id(chat_id)
    if removido:
        await update.message.reply_text(
            "🔓 Conta desconectada com sucesso.\n\n"
            "Para conectar novamente, gere um novo código no painel do YouVisa."
        )
    else:
        await update.message.reply_text("Nenhuma conta conectada a este chat.")


# --- Handler de texto ---

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    texto = update.message.text.strip()

    # Atualizar username do Telegram se mudou
    username = update.effective_user.username
    if username:
        atualizar_username_telegram(chat_id, username)

    # 1) Verificar se há handoff ativo → rotear para handoff
    handoff = buscar_handoff_ativo_por_chat(chat_id)
    if handoff:
        usuario = buscar_usuario_por_chat_id(chat_id)
        usuario_id = usuario["id"] if usuario else None
        salvar_mensagem_handoff(handoff["id"], "usuario", usuario_id, texto)
        await update.message.reply_text(
            "📨 Mensagem encaminhada ao atendente.",
        )
        return

    # 2) Verificar estado de conversa (fluxo de upload)
    estado = buscar_estado_conversa(chat_id)
    if estado["estado"] != "idle":
        await handle_conversa_estado(update, context, estado, texto)
        return

    # 3) Chatbot IA
    usuario = buscar_usuario_por_chat_id(chat_id)
    usuario_id = usuario["id"] if usuario else None
    nome_usuario = usuario["nome"] if usuario else None

    historico = get_historico(chat_id)
    try:
        resultado = gerar_resposta_chatbot(
            mensagem=texto,
            historico_conversa=historico,
            usuario_id=usuario_id,
            nome_usuario=nome_usuario,
        )

        resposta = resultado["resposta"]

        # Se requer auth e não conectado, orientar conexão
        if resultado.get("requer_auth") and not usuario_id:
            resposta = (
                "🔒 Para consultar informações do seu processo, preciso verificar sua identidade.\n\n"
                "Conecte sua conta: acesse o painel YouVisa → \"Conectar Telegram\"."
            )

        add_historico(chat_id, "user", texto)
        add_historico(chat_id, "model", resposta)

        await update.message.reply_text(resposta)
    except Exception as e:
        logger.error(f"Erro no chatbot para chat_id={chat_id}: {e}")
        await update.message.reply_text(
            "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
        )


async def handle_conversa_estado(update: Update, context: ContextTypes.DEFAULT_TYPE, estado: dict, texto: str):
    """Processa mensagens durante fluxos multi-etapa (upload)."""
    chat_id = update.effective_chat.id
    estado_nome = estado["estado"]
    dados = estado["dados"]

    if texto.lower() == "cancelar":
        limpar_estado_conversa(chat_id)
        await update.message.reply_text(
            "❌ Operação cancelada.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    if estado_nome == "escolher_processo":
        processos = dados.get("processos", [])
        try:
            idx = int(texto) - 1
            if idx < 0 or idx >= len(processos):
                raise ValueError()
        except ValueError:
            await update.message.reply_text("Por favor, escolha um número válido da lista ou envie 'Cancelar'.")
            return

        processo = processos[idx]

        # Listar tipos de documento disponíveis
        from services import TIPO_DOCUMENTO_LABELS
        botoes = []
        tipos = list(TIPO_DOCUMENTO_LABELS.items())
        for key, label in tipos:
            botoes.append([KeyboardButton(label)])
        botoes.append([KeyboardButton("Cancelar")])

        salvar_estado_conversa(chat_id, "escolher_tipo_doc", {
            "processo_id": processo["id"],
            "processo_tipo": processo["tipo"],
            "usuario_id": dados["usuario_id"],
            "tipos_map": {label: key for key, label in tipos},
        })

        await update.message.reply_text(
            f"📎 Processo #{processo['id']} selecionado.\n\nEscolha o *tipo de documento*:",
            parse_mode="Markdown",
            reply_markup=ReplyKeyboardMarkup(botoes, one_time_keyboard=True, resize_keyboard=True),
        )

    elif estado_nome == "escolher_tipo_doc":
        tipos_map = dados.get("tipos_map", {})
        tipo_doc = tipos_map.get(texto)
        if not tipo_doc:
            await update.message.reply_text("Tipo inválido. Escolha da lista ou envie 'Cancelar'.")
            return

        salvar_estado_conversa(chat_id, "aguardando_arquivo", {
            "processo_id": dados["processo_id"],
            "processo_tipo": dados["processo_tipo"],
            "usuario_id": dados["usuario_id"],
            "tipo_documento": tipo_doc,
        })

        await update.message.reply_text(
            f"📎 Tipo: *{texto}*\n\nAgora envie o arquivo (foto ou documento).",
            parse_mode="Markdown",
            reply_markup=ReplyKeyboardRemove(),
        )

    elif estado_nome == "aguardando_arquivo":
        await update.message.reply_text(
            "📎 Por favor, envie uma *foto* ou *arquivo* (não texto).\n\nOu envie 'Cancelar' para cancelar.",
            parse_mode="Markdown",
        )


# --- Handler de foto/arquivo ---

async def handle_document_or_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    estado = buscar_estado_conversa(chat_id)

    if estado["estado"] != "aguardando_arquivo":
        await update.message.reply_text(
            "📎 Para enviar documentos, use o comando /enviar primeiro."
        )
        return

    dados = estado["dados"]
    processo_id = dados["processo_id"]
    tipo_documento = dados["tipo_documento"]
    usuario_id = dados["usuario_id"]

    # Verificar que o processo pertence ao usuário
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, usuario_id, status FROM processos WHERE id = %s", (processo_id,))
    processo = cur.fetchone()
    if not processo or processo["usuario_id"] != usuario_id:
        cur.close()
        conn.close()
        limpar_estado_conversa(chat_id)
        await update.message.reply_text("❌ Processo não encontrado ou acesso negado.")
        return

    # Baixar arquivo do Telegram
    if update.message.photo:
        file = await update.message.photo[-1].get_file()
        nome_original = "foto_telegram.jpg"
        extensao = ".jpg"
        tipo_arquivo = "image/jpeg"
    elif update.message.document:
        file = await update.message.document.get_file()
        nome_original = update.message.document.file_name or "documento"
        extensao = os.path.splitext(nome_original)[1] or ""
        tipo_arquivo = update.message.document.mime_type or "application/octet-stream"
    else:
        await update.message.reply_text("❌ Formato não suportado. Envie uma foto ou documento.")
        return

    nome_arquivo = f"{uuid.uuid4().hex}{extensao}"
    caminho = os.path.join(UPLOAD_DIR, nome_arquivo)

    await file.download_to_drive(caminho)
    tamanho = os.path.getsize(caminho)

    # Inserir no banco
    cur.execute(
        """INSERT INTO documentos (processo_id, nome_original, nome_arquivo, tipo_arquivo, tipo_documento, tamanho)
           VALUES (%s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (processo_id, nome_original, nome_arquivo, tipo_arquivo, tipo_documento, tamanho),
    )
    doc_id = cur.fetchone()["id"]

    # Vincular à solicitação pendente ou rejeitada se houver
    cur.execute(
        """UPDATE solicitacoes_documento
           SET documento_id = %s, status = 'enviado', atualizado_em = NOW()
           WHERE id = (
               SELECT id FROM solicitacoes_documento
               WHERE processo_id = %s AND tipo_documento = %s AND (
                   (status = 'pendente' AND documento_id IS NULL)
                   OR status = 'rejeitado'
               )
               ORDER BY CASE WHEN status = 'rejeitado' THEN 0 ELSE 1 END, id
               LIMIT 1
           )""",
        (doc_id, processo_id, tipo_documento),
    )

    # Auto-transição para em_analise
    status_atual = processo["status"]
    if status_atual == "recebido":
        cur.execute(
            "SELECT COUNT(DISTINCT tipo_documento) AS cnt FROM documentos WHERE processo_id = %s AND tipo_documento IN ('passaporte', 'foto')",
            (processo_id,),
        )
        tipos_enviados = cur.fetchone()["cnt"]
        if tipos_enviados >= 2:
            cur.execute(
                "UPDATE processos SET status = 'em_analise', atualizado_em = NOW() WHERE id = %s",
                (processo_id,),
            )
            cur.execute(
                """INSERT INTO transicoes_processo (processo_id, status_anterior, status_novo, responsavel_id, responsavel_tipo, observacao)
                   VALUES (%s, 'recebido', 'em_analise', %s, 'usuario', 'Transição automática: documentos obrigatórios enviados via Telegram')""",
                (processo_id, usuario_id),
            )

    conn.commit()
    cur.close()
    conn.close()

    limpar_estado_conversa(chat_id)
    await update.message.reply_text(
        template_upload_confirmacao(tipo_documento, processo_id),
        parse_mode="Markdown",
    )


# --- Main ---

def main():
    if not TELEGRAM_BOT_TOKEN:
        print("ERRO: TELEGRAM_BOT_TOKEN não configurado no .env")
        return

    init_pool()
    init_db()

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    # Comandos
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("ajuda", cmd_ajuda))
    app.add_handler(CommandHandler("help", cmd_ajuda))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("documentos", cmd_documentos))
    app.add_handler(CommandHandler("enviar", cmd_enviar))
    app.add_handler(CommandHandler("atendente", cmd_atendente))
    app.add_handler(CommandHandler("desconectar", cmd_desvincular))

    # Fotos e documentos (antes do handler de texto)
    app.add_handler(MessageHandler(filters.PHOTO | filters.Document.ALL, handle_document_or_photo))

    # Texto livre
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    print("YouVisa Telegram Bot iniciado. Pressione Ctrl+C para parar.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
