"""Serviços de integração Telegram para o YouVisa."""

import uuid
import json
import threading
import requests
from datetime import datetime, timedelta, timezone

from config import TELEGRAM_BOT_TOKEN
from database import get_connection


# --- Vinculação de Conta ---

def gerar_codigo_vinculacao(usuario_id: int) -> str:
    """Gera código único para vincular conta Telegram. Expira em 15 minutos."""
    conn = get_connection()
    cur = conn.cursor()
    # Invalidar códigos anteriores do mesmo usuário
    cur.execute(
        "UPDATE telegram_codigos_vinculacao SET usado = TRUE WHERE usuario_id = %s AND usado = FALSE",
        (usuario_id,),
    )
    codigo = uuid.uuid4().hex[:12]
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=15)
    cur.execute(
        "INSERT INTO telegram_codigos_vinculacao (usuario_id, codigo, expira_em) VALUES (%s, %s, %s)",
        (usuario_id, codigo, expira_em),
    )
    conn.commit()
    cur.close()
    conn.close()
    return codigo


def vincular_conta(codigo: str, telegram_chat_id: int, telegram_username: str | None = None) -> dict | None:
    """Valida código de vinculação e cria o vínculo. Retorna dados do usuário ou None."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, usuario_id FROM telegram_codigos_vinculacao
           WHERE codigo = %s AND usado = FALSE AND expira_em > NOW()
           ORDER BY criado_em DESC LIMIT 1""",
        (codigo,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return None

    usuario_id = row["usuario_id"]

    # Marcar código como usado
    cur.execute("UPDATE telegram_codigos_vinculacao SET usado = TRUE WHERE id = %s", (row["id"],))

    # Remover vínculo anterior do mesmo usuário ou chat_id (se houver)
    cur.execute("DELETE FROM telegram_vinculos WHERE usuario_id = %s OR telegram_chat_id = %s",
                (usuario_id, telegram_chat_id))

    cur.execute(
        "INSERT INTO telegram_vinculos (usuario_id, telegram_chat_id, telegram_username) VALUES (%s, %s, %s)",
        (usuario_id, telegram_chat_id, telegram_username),
    )

    # Buscar dados do usuário
    cur.execute("SELECT id, nome, email FROM usuarios WHERE id = %s", (usuario_id,))
    usuario = dict(cur.fetchone())

    conn.commit()
    cur.close()
    conn.close()
    return usuario


def desvincular_conta(usuario_id: int) -> bool:
    """Remove vínculo Telegram do usuário."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM telegram_vinculos WHERE usuario_id = %s RETURNING id", (usuario_id,))
    deleted = cur.fetchone() is not None
    conn.commit()
    cur.close()
    conn.close()
    return deleted


def desvincular_por_chat_id(telegram_chat_id: int) -> bool:
    """Remove vínculo Telegram pelo chat_id."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM telegram_vinculos WHERE telegram_chat_id = %s RETURNING id", (telegram_chat_id,))
    deleted = cur.fetchone() is not None
    conn.commit()
    cur.close()
    conn.close()
    return deleted


def buscar_usuario_por_chat_id(telegram_chat_id: int) -> dict | None:
    """Busca usuário vinculado pelo chat_id do Telegram."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT u.id, u.nome, u.email, tv.telegram_username
           FROM telegram_vinculos tv
           JOIN usuarios u ON tv.usuario_id = u.id
           WHERE tv.telegram_chat_id = %s""",
        (telegram_chat_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def atualizar_username_telegram(telegram_chat_id: int, telegram_username: str | None):
    """Atualiza o username do Telegram se mudou."""
    if not telegram_username:
        return
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE telegram_vinculos SET telegram_username = %s WHERE telegram_chat_id = %s AND (telegram_username IS DISTINCT FROM %s)",
        (telegram_username, telegram_chat_id, telegram_username),
    )
    conn.commit()
    cur.close()
    conn.close()


def buscar_chat_id_por_usuario(usuario_id: int) -> int | None:
    """Busca chat_id do Telegram pelo usuario_id."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT telegram_chat_id FROM telegram_vinculos WHERE usuario_id = %s",
        (usuario_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["telegram_chat_id"] if row else None


def buscar_status_vinculacao(usuario_id: int) -> dict:
    """Retorna status de vinculação Telegram do usuário."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT telegram_username FROM telegram_vinculos WHERE usuario_id = %s",
        (usuario_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        return {"vinculado": True, "telegram_username": row["telegram_username"]}
    return {"vinculado": False}


# --- Envio de Mensagem Telegram ---

def enviar_notificacao_telegram(chat_id: int, mensagem: str, parse_mode: str = "Markdown"):
    """Envia mensagem via Telegram Bot API em thread separada."""
    def _enviar():
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": mensagem,
                "parse_mode": parse_mode,
            }
            resp = requests.post(url, json=payload, timeout=10)
            if not resp.ok:
                print(f"[TELEGRAM ERRO] Falha ao enviar para chat_id={chat_id}: {resp.text}")
        except Exception as e:
            print(f"[TELEGRAM ERRO] Exceção ao enviar para chat_id={chat_id}: {e}")

    thread = threading.Thread(target=_enviar, daemon=True)
    thread.start()


def enviar_notificacao_telegram_sync(chat_id: int, mensagem: str, parse_mode: str = "Markdown") -> tuple[bool, str | None]:
    """Envia mensagem via Telegram Bot API (síncrono). Retorna (sucesso, erro)."""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": mensagem,
            "parse_mode": parse_mode,
        }
        resp = requests.post(url, json=payload, timeout=10)
        if resp.ok:
            return True, None
        return False, resp.text
    except Exception as e:
        return False, str(e)


# --- Estado de Conversa (fluxo multi-etapa) ---

def salvar_estado_conversa(chat_id: int, estado: str, dados: dict | None = None):
    """Salva ou atualiza estado de conversa do Telegram."""
    conn = get_connection()
    cur = conn.cursor()
    dados_json = json.dumps(dados or {})
    cur.execute(
        """MERGE INTO telegram_conversas tc
           USING (SELECT %s AS chat_id, %s AS estado, %s AS dados FROM dual) src
           ON (tc.telegram_chat_id = src.chat_id)
           WHEN MATCHED THEN UPDATE SET tc.estado = src.estado, tc.dados = src.dados, tc.atualizado_em = SYSTIMESTAMP
           WHEN NOT MATCHED THEN INSERT (telegram_chat_id, estado, dados, atualizado_em)
                VALUES (src.chat_id, src.estado, src.dados, SYSTIMESTAMP)""",
        (chat_id, estado, dados_json),
    )
    conn.commit()
    cur.close()
    conn.close()


def buscar_estado_conversa(chat_id: int) -> dict:
    """Busca estado de conversa atual. Retorna {estado, dados}."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT estado, dados FROM telegram_conversas WHERE telegram_chat_id = %s",
        (chat_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row:
        return {"estado": row["estado"], "dados": row["dados"] or {}}
    return {"estado": "idle", "dados": {}}


def limpar_estado_conversa(chat_id: int):
    """Reseta estado de conversa para idle."""
    salvar_estado_conversa(chat_id, "idle", {})


# --- Human Handoff ---

def criar_handoff(usuario_id: int | None, telegram_chat_id: int | None = None, motivo: str | None = None, canal: str = "telegram") -> int:
    """Cria solicitação de handoff. Retorna o ID."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO handoff_solicitacoes (usuario_id, telegram_chat_id, canal, motivo)
           VALUES (%s, %s, %s, %s)
           RETURNING id""",
        (usuario_id, telegram_chat_id, canal, motivo),
    )
    handoff_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return handoff_id


def buscar_handoff_ativo_por_chat(telegram_chat_id: int) -> dict | None:
    """Verifica se há handoff ativo (pendente ou em_atendimento) para o chat_id."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT h.id, h.usuario_id, h.status, h.atendido_por, f.nome as nome_atendente
           FROM handoff_solicitacoes h
           LEFT JOIN funcionarios f ON h.atendido_por = f.id
           WHERE h.telegram_chat_id = %s AND h.status IN ('pendente', 'em_atendimento')
           ORDER BY h.criado_em DESC LIMIT 1""",
        (telegram_chat_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def buscar_handoff_ativo_por_usuario(usuario_id: int) -> dict | None:
    """Verifica se há handoff ativo (pendente ou em_atendimento) para o usuario_id."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT h.id, h.usuario_id, h.status, h.atendido_por, f.nome as nome_atendente
           FROM handoff_solicitacoes h
           LEFT JOIN funcionarios f ON h.atendido_por = f.id
           WHERE h.usuario_id = %s AND h.status IN ('pendente', 'em_atendimento')
           ORDER BY h.criado_em DESC LIMIT 1""",
        (usuario_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def salvar_mensagem_handoff(handoff_id: int, remetente_tipo: str, remetente_id: int | None, conteudo: str) -> int:
    """Salva mensagem no chat de handoff. Retorna o ID da mensagem."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO handoff_mensagens (handoff_id, remetente_tipo, remetente_id, conteudo)
           VALUES (%s, %s, %s, %s)
           RETURNING id""",
        (handoff_id, remetente_tipo, remetente_id, conteudo),
    )
    msg_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return msg_id


def buscar_mensagens_handoff(handoff_id: int) -> list[dict]:
    """Lista mensagens de um handoff."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT hm.id, hm.remetente_tipo, hm.remetente_id, hm.conteudo, hm.criado_em,
                  COALESCE(u.nome, f.nome) as nome_remetente
           FROM handoff_mensagens hm
           LEFT JOIN usuarios u ON hm.remetente_tipo = 'usuario' AND hm.remetente_id = u.id
           LEFT JOIN funcionarios f ON hm.remetente_tipo = 'funcionario' AND hm.remetente_id = f.id
           WHERE hm.handoff_id = %s
           ORDER BY hm.criado_em ASC""",
        (handoff_id,),
    )
    msgs = [dict(m) for m in cur.fetchall()]
    cur.close()
    conn.close()
    return msgs


def buscar_handoffs(status_filtro: str | None = None) -> list[dict]:
    """Lista handoff solicitações. Opcionalmente filtra por status."""
    conn = get_connection()
    cur = conn.cursor()
    query = """
        SELECT h.id, h.usuario_id, h.telegram_chat_id, h.canal, h.motivo, h.status,
               h.atendido_por, h.criado_em, h.atualizado_em,
               u.nome as nome_usuario, u.email as email_usuario,
               f.nome as nome_atendente
        FROM handoff_solicitacoes h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        LEFT JOIN funcionarios f ON h.atendido_por = f.id
    """
    params = []
    if status_filtro:
        query += " WHERE h.status = %s"
        params.append(status_filtro)
    query += " ORDER BY h.criado_em DESC"
    cur.execute(query, params)
    results = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return results


def buscar_handoffs_por_usuario(usuario_id: int) -> list[dict]:
    """Lista handoff solicitações de um usuário específico, ordenado do mais recente para o mais antigo."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT h.id, h.usuario_id, h.telegram_chat_id, h.canal, h.motivo, h.status,
                  h.atendido_por, h.criado_em, h.atualizado_em,
                  u.nome as nome_usuario, u.email as email_usuario,
                  f.nome as nome_atendente
           FROM handoff_solicitacoes h
           LEFT JOIN usuarios u ON h.usuario_id = u.id
           LEFT JOIN funcionarios f ON h.atendido_por = f.id
           WHERE h.usuario_id = %s
           ORDER BY h.criado_em DESC""",
        (usuario_id,),
    )
    results = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return results


def atualizar_handoff(handoff_id: int, status: str, atendido_por: int | None = None) -> dict | None:
    """Atualiza status de um handoff. Retorna handoff atualizado."""
    conn = get_connection()
    cur = conn.cursor()
    if atendido_por:
        cur.execute(
            """UPDATE handoff_solicitacoes
               SET status = %s, atendido_por = %s, atualizado_em = NOW()
               WHERE id = %s RETURNING *""",
            (status, atendido_por, handoff_id),
        )
    else:
        cur.execute(
            """UPDATE handoff_solicitacoes
               SET status = %s, atualizado_em = NOW()
               WHERE id = %s RETURNING *""",
            (status, handoff_id),
        )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return dict(row) if row else None


def buscar_handoff_por_id(handoff_id: int) -> dict | None:
    """Busca handoff por ID com dados do usuário e atendente."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT h.*, u.nome as nome_usuario, u.email as email_usuario,
                  f.nome as nome_atendente
           FROM handoff_solicitacoes h
           LEFT JOIN usuarios u ON h.usuario_id = u.id
           LEFT JOIN funcionarios f ON h.atendido_por = f.id
           WHERE h.id = %s""",
        (handoff_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None
