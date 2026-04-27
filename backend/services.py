import random
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

from config import SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_PASSWORD, FRONTEND_URL, OTP_EXPIRATION_MINUTES
from database import get_connection


def gerar_codigo_otp() -> str:
    return str(random.randint(100000, 999999))


def salvar_otp(email: str, codigo: str, tipo: str):
    conn = get_connection()
    cur = conn.cursor()
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)
    cur.execute(
        "UPDATE codigos_otp SET usado = TRUE WHERE email = %s AND tipo = %s AND usado = FALSE",
        (email, tipo)
    )
    cur.execute(
        "INSERT INTO codigos_otp (email, codigo, tipo, expira_em) VALUES (%s, %s, %s, %s)",
        (email, codigo, tipo, expira_em)
    )
    conn.commit()
    cur.close()
    conn.close()


def verificar_otp(email: str, codigo: str, tipo: str) -> bool:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT id FROM codigos_otp
           WHERE email = %s AND codigo = %s AND tipo = %s
           AND usado = FALSE AND expira_em > NOW()
           ORDER BY criado_em DESC LIMIT 1""",
        (email, codigo, tipo)
    )
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE codigos_otp SET usado = TRUE WHERE id = %s", (row["id"],))
        conn.commit()
        cur.close()
        conn.close()
        return True
    cur.close()
    conn.close()
    return False


def enviar_email_otp(destinatario: str, codigo: str, assunto: str | None = None):
    # Busca idioma pelo email; fallback pt-BR
    try:
        idioma = _buscar_idioma_por_email(destinatario)
    except Exception:
        idioma = "pt-BR"
    is_en = idioma == "en-US"

    if assunto is None:
        assunto = "Your verification code - YouVisa" if is_en else "Seu código de verificação - YouVisa"

    L = {
        "tagline": "Your Global Journey, Simplified" if is_en else "Sua Jornada Global, Simplificada",
        "codigo_label": "Your verification code is:" if is_en else "Seu código de verificação é:",
        "expira": (
            f"This code expires in {OTP_EXPIRATION_MINUTES} minutes.<br>If you did not request this code, please ignore this e-mail."
            if is_en
            else f"Este código expira em {OTP_EXPIRATION_MINUTES} minutos.<br>Se você não solicitou este código, ignore este e-mail."
        ),
    }

    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM
    msg["To"] = destinatario
    msg["Subject"] = assunto

    corpo = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 40px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #2563eb; margin: 0;">YouVisa</h1>
                <p style="color: #64748b; margin-top: 8px;">{L['tagline']}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #334155; font-size: 16px;">{L['codigo_label']}</p>
            <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 16px 32px; border-radius: 12px; display: inline-block;">{codigo}</span>
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">
                {L['expira']}
            </p>
        </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(corpo, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_FROM, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, destinatario, msg.as_string())


# --- Notificações de Mudança de Status ---

STATUS_LABELS = {
    "recebido": "Recebido",
    "em_analise": "Em Análise",
    "documentos_pendentes": "Documentos Pendentes",
    "em_processamento": "Em Processamento",
    "aprovado": "Aprovado",
    "rejeitado": "Rejeitado",
    "cancelado": "Cancelado",
}

STATUS_CORES = {
    "recebido": {"bg": "#f1f5f9", "text": "#475569", "icon": "📥"},
    "em_analise": {"bg": "#fef9c3", "text": "#a16207", "icon": "🔍"},
    "documentos_pendentes": {"bg": "#ffedd5", "text": "#c2410c", "icon": "📋"},
    "em_processamento": {"bg": "#dbeafe", "text": "#1d4ed8", "icon": "⚙️"},
    "aprovado": {"bg": "#dcfce7", "text": "#15803d", "icon": "✅"},
    "rejeitado": {"bg": "#fee2e2", "text": "#dc2626", "icon": "❌"},
    "cancelado": {"bg": "#f3f4f6", "text": "#6b7280", "icon": "🚫"},
}

STATUS_MENSAGENS = {
    "em_analise": {
        "titulo": "Seu processo está sendo analisado",
        "descricao": "Nossa equipe começou a revisar sua documentação. Você será notificado sobre os próximos passos.",
    },
    "documentos_pendentes": {
        "titulo": "Documentação pendente",
        "descricao": "Identificamos que faltam documentos para dar continuidade ao seu processo. Por favor, acesse seu painel e envie os documentos solicitados o mais breve possível.",
    },
    "em_processamento": {
        "titulo": "Seu processo está em processamento",
        "descricao": "Toda a documentação foi verificada e seu processo está sendo encaminhado. Aguarde a conclusão da análise.",
    },
    "aprovado": {
        "titulo": "Parabéns! Seu processo foi aprovado",
        "descricao": "Temos o prazer de informar que seu processo foi aprovado com sucesso. Acesse o painel para mais detalhes sobre os próximos passos.",
    },
    "rejeitado": {
        "titulo": "Seu processo foi rejeitado",
        "descricao": "Infelizmente seu processo não foi aprovado. Acesse o painel para verificar os detalhes e, se necessário, entre em contato com nossa equipe para mais informações.",
    },
    "cancelado": {
        "titulo": "Seu processo foi cancelado",
        "descricao": "Seu processo foi cancelado. Se você acredita que isso foi um erro, por favor entre em contato com nossa equipe de suporte.",
    },
}

TIPO_VISTO_LABELS = {
    "visto_turista": "Visto de Turista",
    "visto_estudante": "Visto de Estudante",
    "visto_trabalho": "Visto de Trabalho",
    "imigracao": "Imigração",
    "intercambio": "Intercâmbio de Idiomas",
}

# --- English parallel dicts ---

STATUS_LABELS_EN = {
    "recebido": "Received",
    "em_analise": "Under Review",
    "documentos_pendentes": "Pending Documents",
    "em_processamento": "Processing",
    "aprovado": "Approved",
    "rejeitado": "Rejected",
    "cancelado": "Cancelled",
}

STATUS_MENSAGENS_EN = {
    "em_analise": {
        "titulo": "Your case is being reviewed",
        "descricao": "Our team has started reviewing your documentation. You will be notified about the next steps.",
    },
    "documentos_pendentes": {
        "titulo": "Pending documentation",
        "descricao": "We identified that some documents are missing to continue your case. Please access your dashboard and upload the requested documents as soon as possible.",
    },
    "em_processamento": {
        "titulo": "Your case is being processed",
        "descricao": "All documentation has been verified and your case is being forwarded. Please await the conclusion of the review.",
    },
    "aprovado": {
        "titulo": "Congratulations! Your case was approved",
        "descricao": "We are pleased to inform you that your case has been successfully approved. Access your dashboard for more details on the next steps.",
    },
    "rejeitado": {
        "titulo": "Your case was rejected",
        "descricao": "Unfortunately, your case was not approved. Access your dashboard to check the details and, if needed, contact our team for more information.",
    },
    "cancelado": {
        "titulo": "Your case was cancelled",
        "descricao": "Your case has been cancelled. If you believe this was a mistake, please contact our support team.",
    },
}

TIPO_VISTO_LABELS_EN = {
    "visto_turista": "Tourist Visa",
    "visto_estudante": "Student Visa",
    "visto_trabalho": "Work Visa",
    "imigracao": "Immigration",
    "intercambio": "Language Exchange",
}

TIPO_DOCUMENTO_LABELS_EN = {
    "passaporte": "Passport",
    "foto": "Photo 3x4",
    "comprovante_financeiro": "Proof of Funds",
    "carta_convite": "Invitation Letter",
    "seguro_viagem": "Travel Insurance",
    "comprovante_matricula": "Enrollment Proof",
    "contrato_trabalho": "Employment Contract",
    "comprovante_residencia": "Proof of Residence",
    "certidao_nascimento": "Birth Certificate",
    "certidao_casamento": "Marriage Certificate",
    "antecedentes_criminais": "Criminal Background Check",
    "exame_medico": "Medical Exam",
    "formulario_ds160": "DS-160 Form",
    "comprovante_pagamento_taxa": "Fee Payment Receipt",
    "outro": "Other",
}


def _buscar_idioma_usuario(usuario_id: int) -> str:
    """Busca o idioma preferido do usuario. Retorna 'pt-BR' como fallback."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT idioma FROM usuarios WHERE id = %s", (usuario_id,))
            row = cur.fetchone()
            cur.close()
            if row and row.get("idioma"):
                return row["idioma"]
    except Exception:
        pass
    return "pt-BR"


def _buscar_idioma_por_email(email: str) -> str:
    """Busca o idioma preferido pelo email. Retorna 'pt-BR' como fallback."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT idioma FROM usuarios WHERE email = %s", (email,))
            row = cur.fetchone()
            cur.close()
            if row and row.get("idioma"):
                return row["idioma"]
    except Exception:
        pass
    return "pt-BR"


def _gerar_template_notificacao(
    nome_usuario: str,
    tipo_processo: str,
    status_anterior: str,
    status_novo: str,
    observacao: str | None = None,
    idioma: str = "pt-BR",
) -> str:
    is_en = idioma == "en-US"
    cor = STATUS_CORES.get(status_novo, STATUS_CORES["recebido"])
    if is_en:
        status_labels = STATUS_LABELS_EN
        tipo_visto_labels = TIPO_VISTO_LABELS_EN
        default_msg = {
            "titulo": f"Status updated to {STATUS_LABELS_EN.get(status_novo, status_novo)}",
            "descricao": "Access your dashboard for more details.",
        }
        msg_status = STATUS_MENSAGENS_EN.get(status_novo, default_msg)
    else:
        status_labels = STATUS_LABELS
        tipo_visto_labels = TIPO_VISTO_LABELS
        default_msg = {
            "titulo": f"Status atualizado para {STATUS_LABELS.get(status_novo, status_novo)}",
            "descricao": "Acesse seu painel para mais detalhes.",
        }
        msg_status = STATUS_MENSAGENS.get(status_novo, default_msg)

    label_anterior = status_labels.get(status_anterior, status_anterior)
    label_novo = status_labels.get(status_novo, status_novo)
    label_tipo = tipo_visto_labels.get(tipo_processo, tipo_processo)

    L = {
        "tagline": "Your Global Journey, Simplified" if is_en else "Sua Jornada Global, Simplificada",
        "hello": "Hello" if is_en else "Olá",
        "processo": "Case:" if is_en else "Processo:",
        "anterior": "Previous status:" if is_en else "Status anterior:",
        "novo": "New status:" if is_en else "Novo status:",
        "cta": "Access My Dashboard" if is_en else "Acessar Meu Painel",
        "obs_titulo": "Team note:" if is_en else "Observação da equipe:",
        "footer": (
            "This e-mail was automatically sent by the YouVisa system.<br>If you have any questions, please contact our support team."
            if is_en
            else "Este e-mail foi enviado automaticamente pelo sistema YouVisa.<br>Caso tenha dúvidas, entre em contato com nossa equipe de suporte."
        ),
    }

    observacao_html = ""
    if observacao:
        observacao_html = f"""
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 16px;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 4px 0; font-weight: 600;">{L['obs_titulo']}</p>
                <p style="color: #334155; font-size: 14px; margin: 0;">{observacao}</p>
            </div>
        """

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 40px; margin: 0;">
        <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 16px; padding: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e40af, #2563eb); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">YouVisa</h1>
                <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">{L['tagline']}</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0;">
                    {L['hello']}, <strong>{nome_usuario}</strong>!
                </p>

                <!-- Status Badge -->
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 40px;">{cor['icon']}</span>
                    <h2 style="color: #1e293b; font-size: 20px; margin: 12px 0 8px 0;">
                        {msg_status['titulo']}
                    </h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
                        {msg_status['descricao']}
                    </p>
                </div>

                <!-- Status Transition -->
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 140px;">{L['processo']}</td>
                            <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600;">{label_tipo}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">{L['anterior']}</td>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">{label_anterior}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">{L['novo']}</td>
                            <td style="padding: 8px 0;">
                                <span style="background-color: {cor['bg']}; color: {cor['text']}; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; display: inline-block;">
                                    {label_novo}
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>

                {observacao_html}

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 32px;">
                    <a href="{FRONTEND_URL}/dashboard"
                       style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        {L['cta']}
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    {L['footer']}
                </p>
            </div>
        </div>
    </body>
    </html>
    """


def _enviar_email_notificacao(destinatario: str, assunto: str, corpo_html: str):
    """Envia e-mail HTML de notificação."""
    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM
    msg["To"] = destinatario
    msg["Subject"] = assunto
    msg.attach(MIMEText(corpo_html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_FROM, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, destinatario, msg.as_string())


def enviar_notificacao_status(
    processo_id: int,
    usuario_id: int,
    email_destino: str,
    nome_usuario: str,
    tipo_processo: str,
    status_anterior: str,
    status_novo: str,
    observacao: str | None = None,
):
    """
    Envia notificação por e-mail ao cliente quando o status do processo muda.
    Executa em thread separada para não bloquear a resposta da API.
    Registra log na tabela notificacoes.
    """

    idioma = _buscar_idioma_usuario(usuario_id)
    if idioma == "en-US":
        label_novo = STATUS_LABELS_EN.get(status_novo, status_novo)
        assunto = f"YouVisa - Case update: {label_novo}"
    else:
        label_novo = STATUS_LABELS.get(status_novo, status_novo)
        assunto = f"YouVisa — Atualização do seu processo: {label_novo}"

    corpo_html = _gerar_template_notificacao(
        nome_usuario=nome_usuario,
        tipo_processo=tipo_processo,
        status_anterior=status_anterior,
        status_novo=status_novo,
        observacao=observacao,
        idioma=idioma,
    )

    def _enviar_em_background():
        from services_telegram import buscar_chat_id_por_usuario, enviar_notificacao_telegram_sync
        from telegram_templates import template_mudanca_status

        conn = get_connection()
        cur = conn.cursor()
        email_ok = False
        email_erro_msg = None
        tg_ok = False
        tg_erro_msg = None

        # Enviar e-mail
        try:
            _enviar_email_notificacao(email_destino, assunto, corpo_html)
            email_ok = True
            print(f"[NOTIFICACAO] E-mail enviado para {email_destino} — {status_anterior} → {status_novo}")
        except Exception as e:
            email_erro_msg = str(e)
            print(f"[NOTIFICACAO ERRO] Falha ao enviar para {email_destino}: {e}")

        # Enviar Telegram (se vinculado)
        try:
            chat_id = buscar_chat_id_por_usuario(usuario_id)
            if chat_id:
                # Buscar processo_id para template
                msg_tg = template_mudanca_status(
                    nome_usuario=nome_usuario,
                    tipo_processo=tipo_processo,
                    processo_id=processo_id,
                    status_anterior=status_anterior,
                    status_novo=status_novo,
                    observacao=observacao,
                )
                tg_ok, tg_erro_msg = enviar_notificacao_telegram_sync(chat_id, msg_tg)
                if tg_ok:
                    print(f"[NOTIFICACAO] Telegram enviado para chat_id={chat_id}")
                else:
                    print(f"[NOTIFICACAO ERRO] Telegram falhou para chat_id={chat_id}: {tg_erro_msg}")
        except Exception as e:
            tg_erro_msg = str(e)
            print(f"[NOTIFICACAO ERRO] Telegram exceção: {e}")

        # Log na tabela notificacoes
        try:
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, status_anterior, status_novo, enviado, erro, telegram_enviado, telegram_erro)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (processo_id, usuario_id, "mudanca_status", email_destino, assunto, status_anterior, status_novo,
                 email_ok, email_erro_msg, tg_ok, tg_erro_msg)
            )
            conn.commit()
        except Exception:
            pass
        finally:
            cur.close()
            conn.close()

    thread = threading.Thread(target=_enviar_em_background, daemon=True)
    thread.start()


# --- Notificação de Documentos Solicitados ---

TIPO_DOCUMENTO_LABELS = {
    "passaporte": "Passaporte",
    "foto": "Foto 3x4",
    "comprovante_financeiro": "Comprovante Financeiro",
    "carta_convite": "Carta Convite",
    "seguro_viagem": "Seguro Viagem",
    "comprovante_matricula": "Comprovante de Matrícula",
    "contrato_trabalho": "Contrato de Trabalho",
    "comprovante_residencia": "Comprovante de Residência",
    "certidao_nascimento": "Certidão de Nascimento",
    "certidao_casamento": "Certidão de Casamento",
    "antecedentes_criminais": "Antecedentes Criminais",
    "exame_medico": "Exame Médico",
    "formulario_ds160": "Formulário DS-160",
    "comprovante_pagamento_taxa": "Comprovante de Pagamento de Taxa",
    "outro": "Outro",
}


def _gerar_template_documentos_solicitados(
    nome_usuario: str,
    tipo_processo: str,
    documentos_solicitados: list[dict],
    idioma: str = "pt-BR",
) -> str:
    is_en = idioma == "en-US"
    tipo_visto_labels = TIPO_VISTO_LABELS_EN if is_en else TIPO_VISTO_LABELS
    tipo_doc_labels = TIPO_DOCUMENTO_LABELS_EN if is_en else TIPO_DOCUMENTO_LABELS
    L = {
        "tagline": "Your Global Journey, Simplified" if is_en else "Sua Jornada Global, Simplificada",
        "hello": "Hello" if is_en else "Olá",
        "titulo": "Requested Documents" if is_en else "Documentos Solicitados",
        "intro": (
            f"Our team needs the following documents to continue your <strong>{tipo_visto_labels.get(tipo_processo, tipo_processo)}</strong> case."
            if is_en
            else f"Nossa equipe precisa dos seguintes documentos para dar continuidade ao seu processo de <strong>{tipo_visto_labels.get(tipo_processo, tipo_processo)}</strong>."
        ),
        "instrucao": (
            "Please access your dashboard and upload the requested documents as soon as possible."
            if is_en
            else "Por favor, acesse seu painel e envie os documentos solicitados o mais breve possível."
        ),
        "cta": "Upload Documents" if is_en else "Enviar Documentos",
        "footer": (
            "This e-mail was automatically sent by the YouVisa system.<br>If you have any questions, please contact our support team."
            if is_en
            else "Este e-mail foi enviado automaticamente pelo sistema YouVisa.<br>Caso tenha dúvidas, entre em contato com nossa equipe de suporte."
        ),
    }
    label_tipo = tipo_visto_labels.get(tipo_processo, tipo_processo)  # noqa: F841

    itens_html = ""
    for doc in documentos_solicitados:
        label = tipo_doc_labels.get(doc["tipo_documento"], doc["tipo_documento"])
        descricao = f'<p style="color: #64748b; font-size: 13px; margin: 2px 0 0 0;">{doc["descricao"]}</p>' if doc.get("descricao") else ""
        itens_html += f"""
            <div style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
                <p style="color: #1e293b; font-size: 14px; font-weight: 600; margin: 0;">📄 {label}</p>
                {descricao}
            </div>
        """

    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 40px; margin: 0;">
        <div style="max-width: 540px; margin: 0 auto; background: white; border-radius: 16px; padding: 0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e40af, #2563eb); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">YouVisa</h1>
                <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">{L['tagline']}</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0;">
                    {L['hello']}, <strong>{nome_usuario}</strong>!
                </p>

                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 40px;">📋</span>
                    <h2 style="color: #1e293b; font-size: 20px; margin: 12px 0 8px 0;">
                        {L['titulo']}
                    </h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
                        {L['intro']}
                    </p>
                </div>

                <!-- Lista de documentos -->
                <div style="background-color: #f8fafc; border-radius: 12px; overflow: hidden; margin: 24px 0; border: 1px solid #e2e8f0;">
                    {itens_html}
                </div>

                <p style="color: #64748b; font-size: 14px; text-align: center; margin: 16px 0;">
                    {L['instrucao']}
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 32px;">
                    <a href="{FRONTEND_URL}/dashboard"
                       style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        {L['cta']}
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    {L['footer']}
                </p>
            </div>
        </div>
    </body>
    </html>
    """


def enviar_notificacao_documentos_solicitados(
    processo_id: int,
    usuario_id: int,
    email_destino: str,
    nome_usuario: str,
    tipo_processo: str,
    documentos_solicitados: list[dict],
):
    idioma = _buscar_idioma_usuario(usuario_id)
    if idioma == "en-US":
        assunto = "YouVisa - Documents requested for your case"
    else:
        assunto = "YouVisa — Documentos solicitados para seu processo"

    corpo_html = _gerar_template_documentos_solicitados(
        nome_usuario=nome_usuario,
        tipo_processo=tipo_processo,
        documentos_solicitados=documentos_solicitados,
        idioma=idioma,
    )

    def _enviar_em_background():
        from services_telegram import buscar_chat_id_por_usuario, enviar_notificacao_telegram_sync
        from telegram_templates import template_documentos_solicitados as tg_template_docs

        conn = get_connection()
        cur = conn.cursor()
        email_ok = False
        email_erro_msg = None
        tg_ok = False
        tg_erro_msg = None

        # Enviar e-mail
        try:
            _enviar_email_notificacao(email_destino, assunto, corpo_html)
            email_ok = True
            print(f"[NOTIFICACAO] E-mail de documentos solicitados enviado para {email_destino}")
        except Exception as e:
            email_erro_msg = str(e)
            print(f"[NOTIFICACAO ERRO] Falha ao enviar documentos solicitados para {email_destino}: {e}")

        # Enviar Telegram (se vinculado)
        try:
            chat_id = buscar_chat_id_por_usuario(usuario_id)
            if chat_id:
                msg_tg = tg_template_docs(
                    nome_usuario=nome_usuario,
                    tipo_processo=tipo_processo,
                    processo_id=processo_id,
                    documentos=documentos_solicitados,
                )
                tg_ok, tg_erro_msg = enviar_notificacao_telegram_sync(chat_id, msg_tg)
                if tg_ok:
                    print(f"[NOTIFICACAO] Telegram docs solicitados enviado para chat_id={chat_id}")
                else:
                    print(f"[NOTIFICACAO ERRO] Telegram falhou para chat_id={chat_id}: {tg_erro_msg}")
        except Exception as e:
            tg_erro_msg = str(e)
            print(f"[NOTIFICACAO ERRO] Telegram exceção: {e}")

        # Log
        try:
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, enviado, erro, telegram_enviado, telegram_erro)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (processo_id, usuario_id, "documentos_solicitados", email_destino, assunto,
                 email_ok, email_erro_msg, tg_ok, tg_erro_msg)
            )
            conn.commit()
        except Exception:
            pass
        finally:
            cur.close()
            conn.close()

    thread = threading.Thread(target=_enviar_em_background, daemon=True)
    thread.start()


# --- Notificação de Análise de Caso (Copiloto de Prontidão) ---

TIPO_DOCUMENTO_LABELS_NOTIF = {
    "passaporte": "Passaporte",
    "foto": "Foto 3x4",
    "comprovante_financeiro": "Comprovante Financeiro",
    "carta_convite": "Carta Convite",
    "seguro_viagem": "Seguro Viagem",
    "comprovante_matricula": "Comprovante de Matrícula",
    "contrato_trabalho": "Contrato de Trabalho",
    "comprovante_residencia": "Comprovante de Residência",
    "certidao_nascimento": "Certidão de Nascimento",
    "certidao_casamento": "Certidão de Casamento",
    "antecedentes_criminais": "Antecedentes Criminais",
    "exame_medico": "Exame Médico",
    "formulario_ds160": "Formulário DS-160",
    "comprovante_pagamento_taxa": "Comprovante de Pagamento de Taxa",
    "outro": "Outro",
}


def _gerar_template_analise_caso(nome_usuario: str, tipo_processo: str, pontuacao: int,
                                  resumo: str, documentos_faltantes: list[str],
                                  idioma: str = "pt-BR") -> str:
    is_en = idioma == "en-US"
    doc_labels = TIPO_DOCUMENTO_LABELS_EN if is_en else TIPO_DOCUMENTO_LABELS_NOTIF
    tipo_visto_labels = TIPO_VISTO_LABELS_EN if is_en else TIPO_VISTO_LABELS
    L = {
        "subheader": "Case Readiness Analysis" if is_en else "Análise de Prontidão do Caso",
        "hello": "Hello" if is_en else "Olá",
        "intro": "We performed an automated analysis of your" if is_en else "Realizamos uma análise automatizada do seu processo de",
        "readiness_score": "Readiness score" if is_en else "Pontuação de prontidão",
        "summary": "Analysis summary:" if is_en else "Resumo da análise:",
        "missing_docs": "Missing documents:" if is_en else "Documentos faltantes:",
        "cta": "Access My Dashboard" if is_en else "Acessar Meu Painel",
        "footer": "This analysis was automatically generated by the YouVisa system." if is_en else "Esta análise foi gerada automaticamente pelo sistema YouVisa.",
    }
    if pontuacao >= 80:
        cor_score = "#22c55e"
        emoji_score = "&#9989;"
    elif pontuacao >= 50:
        cor_score = "#eab308"
        emoji_score = "&#9888;&#65039;"
    else:
        cor_score = "#ef4444"
        emoji_score = "&#10060;"

    docs_html = ""
    if documentos_faltantes:
        items = "".join(
            f"<li style='margin-bottom:4px'>{doc_labels.get(d, d)}</li>"
            for d in documentos_faltantes
        )
        docs_html = f"""
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0;border-radius:4px">
            <strong>{L['missing_docs']}</strong>
            <ul style="margin:8px 0 0 0;padding-left:20px">{items}</ul>
        </div>"""

    tipo_label = tipo_visto_labels.get(tipo_processo, tipo_processo)

    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:20px">
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:white;padding:24px;border-radius:8px 8px 0 0;text-align:center">
            <h1 style="margin:0;font-size:22px">YouVisa</h1>
            <p style="margin:4px 0 0;opacity:0.9;font-size:14px">{L['subheader']}</p>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
            <p>{L['hello']}, <strong>{nome_usuario}</strong>!</p>
            <p>{L['intro']} <strong>{tipo_label}</strong>.</p>
            <div style="text-align:center;margin:20px 0">
                <div style="display:inline-block;background:{cor_score};color:white;font-size:32px;font-weight:bold;
                            padding:16px 32px;border-radius:12px">
                    {emoji_score} {pontuacao}/100
                </div>
                <p style="color:#6b7280;font-size:13px;margin-top:8px">{L['readiness_score']}</p>
            </div>
            <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0">
                <strong>{L['summary']}</strong>
                <p style="margin:8px 0 0;color:#374151">{resumo}</p>
            </div>
            {docs_html}
            <div style="text-align:center;margin-top:24px">
                <a href="{FRONTEND_URL}/dashboard" style="background:#2563eb;color:white;padding:12px 24px;
                   text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold">
                    {L['cta']}
                </a>
            </div>
            <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center">
                {L['footer']}
            </p>
        </div>
    </div>"""


def enviar_notificacao_analise_caso(
    processo_id: int,
    usuario_id: int,
    email_destino: str,
    nome_usuario: str,
    tipo_processo: str,
    pontuacao: int,
    resumo: str,
    documentos_faltantes: list[str],
):
    idioma = _buscar_idioma_usuario(usuario_id)
    if idioma == "en-US":
        assunto = f"YouVisa - Case readiness analysis ({pontuacao}/100)"
    else:
        assunto = f"YouVisa — Análise de prontidão do seu processo ({pontuacao}/100)"

    corpo_html = _gerar_template_analise_caso(
        nome_usuario=nome_usuario,
        tipo_processo=tipo_processo,
        pontuacao=pontuacao,
        resumo=resumo,
        documentos_faltantes=documentos_faltantes,
        idioma=idioma,
    )

    def _enviar_em_background():
        from services_telegram import buscar_chat_id_por_usuario, enviar_notificacao_telegram_sync

        conn = get_connection()
        cur = conn.cursor()
        email_ok = False
        email_erro_msg = None
        tg_ok = False
        tg_erro_msg = None

        try:
            _enviar_email_notificacao(email_destino, assunto, corpo_html)
            email_ok = True
            print(f"[NOTIFICACAO] E-mail análise caso enviado para {email_destino}")
        except Exception as e:
            email_erro_msg = str(e)
            print(f"[NOTIFICACAO ERRO] Falha envio análise caso para {email_destino}: {e}")

        try:
            chat_id = buscar_chat_id_por_usuario(usuario_id)
            if chat_id:
                docs_text = ""
                if documentos_faltantes:
                    labels = [TIPO_DOCUMENTO_LABELS_NOTIF.get(d, d) for d in documentos_faltantes]
                    docs_text = "\n\n📋 *Documentos faltantes:*\n" + "\n".join(f"  • {l}" for l in labels)

                msg_tg = (
                    f"📊 *Análise de Prontidão*\n\n"
                    f"Seu processo foi analisado e recebeu nota *{pontuacao}/100*.\n\n"
                    f"📝 *Resumo:* {resumo}"
                    f"{docs_text}\n\n"
                    f"Acesse seu painel para mais detalhes."
                )
                tg_ok, tg_erro_msg = enviar_notificacao_telegram_sync(chat_id, msg_tg)
                if tg_ok:
                    print(f"[NOTIFICACAO] Telegram análise caso enviado para chat_id={chat_id}")
        except Exception as e:
            tg_erro_msg = str(e)

        try:
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, enviado, erro, telegram_enviado, telegram_erro)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (processo_id, usuario_id, "analise_caso", email_destino, assunto,
                 email_ok, email_erro_msg, tg_ok, tg_erro_msg)
            )
            conn.commit()
        except Exception:
            pass
        finally:
            cur.close()
            conn.close()

    thread = threading.Thread(target=_enviar_em_background, daemon=True)
    thread.start()
