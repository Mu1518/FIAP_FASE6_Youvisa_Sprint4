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


def enviar_email_otp(destinatario: str, codigo: str, assunto: str = "Seu código de verificação - YouVisa"):
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
                <p style="color: #64748b; margin-top: 8px;">Sua Jornada Global, Simplificada</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            <p style="color: #334155; font-size: 16px;">Seu código de verificação é:</p>
            <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 16px 32px; border-radius: 12px; display: inline-block;">{codigo}</span>
            </div>
            <p style="color: #64748b; font-size: 14px; text-align: center;">
                Este código expira em {OTP_EXPIRATION_MINUTES} minutos.<br>
                Se você não solicitou este código, ignore este e-mail.
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


def _gerar_template_notificacao(
    nome_usuario: str,
    tipo_processo: str,
    status_anterior: str,
    status_novo: str,
    observacao: str | None = None,
) -> str:
    cor = STATUS_CORES.get(status_novo, STATUS_CORES["recebido"])
    msg_status = STATUS_MENSAGENS.get(status_novo, {"titulo": f"Status atualizado para {STATUS_LABELS.get(status_novo, status_novo)}", "descricao": "Acesse seu painel para mais detalhes."})
    label_anterior = STATUS_LABELS.get(status_anterior, status_anterior)
    label_novo = STATUS_LABELS.get(status_novo, status_novo)
    label_tipo = TIPO_VISTO_LABELS.get(tipo_processo, tipo_processo)

    observacao_html = ""
    if observacao:
        observacao_html = f"""
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 16px;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 4px 0; font-weight: 600;">Observação da equipe:</p>
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
                <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Sua Jornada Global, Simplificada</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0;">
                    Olá, <strong>{nome_usuario}</strong>!
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
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 140px;">Processo:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600;">{label_tipo}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Status anterior:</td>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">{label_anterior}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Novo status:</td>
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
                        Acessar Meu Painel
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Este e-mail foi enviado automaticamente pelo sistema YouVisa.<br>
                    Caso tenha dúvidas, entre em contato com nossa equipe de suporte.
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

    label_novo = STATUS_LABELS.get(status_novo, status_novo)
    assunto = f"YouVisa — Atualização do seu processo: {label_novo}"

    corpo_html = _gerar_template_notificacao(
        nome_usuario=nome_usuario,
        tipo_processo=tipo_processo,
        status_anterior=status_anterior,
        status_novo=status_novo,
        observacao=observacao,
    )

    def _enviar_em_background():
        conn = get_connection()
        cur = conn.cursor()
        try:
            _enviar_email_notificacao(email_destino, assunto, corpo_html)
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, status_anterior, status_novo, enviado)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)""",
                (processo_id, usuario_id, "mudanca_status", email_destino, assunto, status_anterior, status_novo)
            )
            conn.commit()
            print(f"[NOTIFICACAO] E-mail enviado para {email_destino} — {status_anterior} → {status_novo}")
        except Exception as e:
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, status_anterior, status_novo, enviado, erro)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE, %s)""",
                (processo_id, usuario_id, "mudanca_status", email_destino, assunto, status_anterior, status_novo, str(e))
            )
            conn.commit()
            print(f"[NOTIFICACAO ERRO] Falha ao enviar para {email_destino}: {e}")
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
) -> str:
    label_tipo = TIPO_VISTO_LABELS.get(tipo_processo, tipo_processo)

    itens_html = ""
    for doc in documentos_solicitados:
        label = TIPO_DOCUMENTO_LABELS.get(doc["tipo_documento"], doc["tipo_documento"])
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
                <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Sua Jornada Global, Simplificada</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
                <p style="color: #334155; font-size: 16px; margin: 0 0 24px 0;">
                    Olá, <strong>{nome_usuario}</strong>!
                </p>

                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 40px;">📋</span>
                    <h2 style="color: #1e293b; font-size: 20px; margin: 12px 0 8px 0;">
                        Documentos Solicitados
                    </h2>
                    <p style="color: #64748b; font-size: 14px; margin: 0; line-height: 1.5;">
                        Nossa equipe precisa dos seguintes documentos para dar continuidade ao seu processo de <strong>{label_tipo}</strong>.
                    </p>
                </div>

                <!-- Lista de documentos -->
                <div style="background-color: #f8fafc; border-radius: 12px; overflow: hidden; margin: 24px 0; border: 1px solid #e2e8f0;">
                    {itens_html}
                </div>

                <p style="color: #64748b; font-size: 14px; text-align: center; margin: 16px 0;">
                    Por favor, acesse seu painel e envie os documentos solicitados o mais breve possível.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 32px;">
                    <a href="{FRONTEND_URL}/dashboard"
                       style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                        Enviar Documentos
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    Este e-mail foi enviado automaticamente pelo sistema YouVisa.<br>
                    Caso tenha dúvidas, entre em contato com nossa equipe de suporte.
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
    assunto = "YouVisa — Documentos solicitados para seu processo"

    corpo_html = _gerar_template_documentos_solicitados(
        nome_usuario=nome_usuario,
        tipo_processo=tipo_processo,
        documentos_solicitados=documentos_solicitados,
    )

    def _enviar_em_background():
        conn = get_connection()
        cur = conn.cursor()
        try:
            _enviar_email_notificacao(email_destino, assunto, corpo_html)
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, enviado)
                   VALUES (%s, %s, %s, %s, %s, TRUE)""",
                (processo_id, usuario_id, "documentos_solicitados", email_destino, assunto)
            )
            conn.commit()
            print(f"[NOTIFICACAO] E-mail de documentos solicitados enviado para {email_destino}")
        except Exception as e:
            cur.execute(
                """INSERT INTO notificacoes (processo_id, usuario_id, tipo, email_destino, assunto, enviado, erro)
                   VALUES (%s, %s, %s, %s, %s, FALSE, %s)""",
                (processo_id, usuario_id, "documentos_solicitados", email_destino, assunto, str(e))
            )
            conn.commit()
            print(f"[NOTIFICACAO ERRO] Falha ao enviar documentos solicitados para {email_destino}: {e}")
        finally:
            cur.close()
            conn.close()

    thread = threading.Thread(target=_enviar_em_background, daemon=True)
    thread.start()
