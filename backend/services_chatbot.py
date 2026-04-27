from google import genai
from config import GEMINI_API_KEY, GEMINI_MODEL
from database import get_connection


class ChatbotError(Exception):
    pass


class ChatbotConfigError(Exception):
    pass


STATUS_LABELS = {
    "recebido": "Recebido",
    "em_analise": "Em Análise",
    "documentos_pendentes": "Documentos Pendentes",
    "em_processamento": "Em Processamento",
    "aprovado": "Aprovado",
    "rejeitado": "Rejeitado",
    "cancelado": "Cancelado",
}

STATUS_EXPLICACOES = {
    "recebido": "Seu processo foi recebido pela nossa equipe e está na fila para análise.",
    "em_analise": "Nossa equipe está analisando sua documentação. Fique tranquilo(a), daremos retorno em breve.",
    "documentos_pendentes": "Precisamos de alguns documentos adicionais para dar continuidade. Acesse seu painel para verificar quais documentos faltam.",
    "em_processamento": "Toda a documentação foi verificada e está tudo certo! Seu processo está sendo encaminhado para a etapa final.",
    "aprovado": "Parabéns! Seu processo foi aprovado com sucesso! Acesse seu painel para conferir os detalhes.",
    "rejeitado": "Infelizmente, seu processo não foi aprovado. Recomendamos acessar seu painel para entender os motivos e, se desejar, entrar em contato com nossa equipe.",
    "cancelado": "Seu processo foi cancelado. Se tiver dúvidas, entre em contato com nossa equipe de suporte.",
}

TIPO_VISTO_LABELS = {
    "visto_turista": "Visto de Turista",
    "visto_estudante": "Visto de Estudante",
    "visto_trabalho": "Visto de Trabalho",
    "imigracao": "Imigração",
    "intercambio": "Intercâmbio de Idiomas",
}

SYSTEM_PROMPT = """Você é o assistente virtual da YouVisa, uma agência de imigração brasileira.
Seu nome é Assistente YouVisa. Você é amigável, claro e acessível.

IDIOMA DA RESPOSTA (REGRA CRÍTICA):
- SEMPRE responda no MESMO idioma da última mensagem do usuário.
- Se o usuário escreveu em português, responda em português brasileiro (pt-BR).
- Se o usuário escreveu em inglês, responda em inglês (English).
- Se o usuário escreveu em outro idioma, responda nesse idioma.
- A preferência salva do usuário serve apenas como desempate quando a mensagem é muito curta ou ambígua (ex.: "ok", "hi").
- NUNCA responda em um idioma diferente do que o usuário usou na última mensagem.

SOBRE A YOUVISA:
A YouVisa é uma plataforma que oferece serviços de vistos e imigração:
- Visto de Turista: para viagens de lazer
- Visto de Estudante: para estudos no exterior
- Visto de Trabalho: para oportunidades profissionais
- Imigração: para residência permanente
- Intercâmbio de Idiomas: para cursos de idiomas no exterior

Para abrir um processo, o cliente precisa: nome completo, data de nascimento, número do passaporte, data de expiração do passaporte e país de destino.
Documentos básicos obrigatórios: cópia do passaporte válido e foto 3x4 recente.

O site da YouVisa permite que o cliente acompanhe o andamento do seu processo em tempo real pelo painel (dashboard).

REGRAS OBRIGATÓRIAS (GUARDRAILS):
1. NUNCA invente, sugira ou infira prazos específicos de aprovação ou conclusão. Diga que prazos dependem de cada caso e do órgão responsável.
2. NUNCA faça promessas de aprovação. Diga que a decisão final depende da análise da equipe e do órgão emissor.
3. NUNCA tome decisões institucionais. Você apenas informa e orienta.
4. NUNCA exponha detalhes técnicos internos do sistema (nomes de tabelas, campos, APIs, IDs internos).
5. Se não souber a resposta, diga que não tem essa informação e sugira contato com a equipe pelo site.
6. Traduza termos técnicos para linguagem simples e acessível.
7. Para alterações de dados ou cancelamentos, oriente o usuário a fazer pelo painel do site.
8. Seja conciso nas respostas, mas completo quando necessário.

QUANDO O USUÁRIO NÃO ESTIVER AUTENTICADO:
- Responda perguntas gerais sobre vistos, serviços da YouVisa, documentos necessários, etc.
- Se perguntar sobre status de processo, documentos pendentes ou informações pessoais, informe que precisa se identificar primeiro.

QUANDO O USUÁRIO ESTIVER AUTENTICADO:
- Use o contexto dos processos fornecido para dar respostas personalizadas.
- Explique o status de forma clara e acessível.
- Informe quais documentos estão pendentes.
- Oriente sobre os próximos passos com base no status atual.
"""


def _detectar_idioma_mensagem(mensagem: str) -> str | None:
    """Heurística leve para detectar o idioma da mensagem do usuário.

    Retorna 'pt-BR', 'en-US' ou None (quando ambíguo/curto demais).
    Não depende de bibliotecas externas — usa marcadores comuns.
    """
    if not mensagem:
        return None
    texto = mensagem.lower().strip()
    # Muito curta/ambígua
    if len(texto) < 4:
        return None

    # Caracteres exclusivos do português (acentos, ç, til)
    if any(ch in texto for ch in "ãõáéíóúâêôçà"):
        return "pt-BR"

    palavras = set(
        "".join(c if c.isalpha() or c.isspace() else " " for c in texto).split()
    )

    pt_markers = {
        "olá", "ola", "oi", "bom", "boa", "dia", "tarde", "noite", "obrigado", "obrigada",
        "por", "favor", "você", "voce", "seu", "sua", "meu", "minha", "processo", "documento",
        "documentos", "visto", "quero", "preciso", "falar", "atendente", "status", "qual",
        "como", "está", "esta", "quando", "onde", "estou", "eu", "não", "nao", "sim",
        "pra", "para", "com", "sem", "que", "quais", "foto", "passaporte", "enviar",
        "cancelar", "ajuda", "mensagem", "boas", "obrigadão",
    }
    en_markers = {
        "hello", "hi", "hey", "please", "thanks", "thank", "you", "your", "my", "the",
        "what", "when", "where", "how", "is", "are", "do", "does", "did", "can",
        "could", "would", "should", "will", "i", "me", "we", "they", "process",
        "document", "documents", "visa", "want", "need", "speak", "agent", "status",
        "passport", "photo", "send", "cancel", "help", "message",
    }

    pt_hits = len(palavras & pt_markers)
    en_hits = len(palavras & en_markers)

    if pt_hits == 0 and en_hits == 0:
        return None
    if pt_hits > en_hits:
        return "pt-BR"
    if en_hits > pt_hits:
        return "en-US"
    return None


def classificar_intencao(mensagem: str) -> str:
    texto = mensagem.lower().strip()

    saudacao_palavras = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hello", "e aí", "eai"]
    if any(texto.startswith(p) or texto == p for p in saudacao_palavras):
        return "saudacao"

    despedida_palavras = ["tchau", "até logo", "ate logo", "valeu", "obrigado", "obrigada", "flw", "bye"]
    if any(p in texto for p in despedida_palavras):
        return "despedida"

    analise_indicadores = [
        "pronto", "preparado", "está pronto", "esta pronto", "análise do caso", "analise do caso",
        "prontidão", "prontidao", "caso pronto", "submissão", "submissao",
        "readiness", "caso está pronto", "caso esta pronto",
    ]
    if any(p in texto for p in analise_indicadores):
        return "analise_caso"

    alteracao_indicadores = [
        "alterar", "mudar", "editar", "atualizar", "trocar", "corrigir",
        "modificar", "cancelar processo", "cancelar meu",
    ]
    if any(p in texto for p in alteracao_indicadores):
        return "alteracao_dados"

    status_indicadores = [
        "status", "andamento", "situação", "situacao", "como está", "como esta",
        "meu processo", "meu visto", "qual o status", "em que etapa", "em que fase",
    ]
    if any(p in texto for p in status_indicadores):
        return "status_query"

    doc_indicadores = [
        "documento", "falta", "faltam", "pendente", "enviar", "upload",
        "quais documentos", "que documentos",
    ]
    if any(p in texto for p in doc_indicadores):
        return "documento_query"

    passo_indicadores = [
        "próximo passo", "proximo passo", "o que faço", "o que faco",
        "próxima etapa", "proxima etapa", "o que devo", "qual o próximo", "qual o proximo",
    ]
    if any(p in texto for p in passo_indicadores):
        return "proximo_passo"

    atendente_indicadores = [
        "falar com atendente", "atendente humano", "falar com pessoa",
        "atendente", "pessoa real", "humano", "suporte humano",
        "falar com alguém", "falar com alguem", "falar com um humano",
    ]
    if any(p in texto for p in atendente_indicadores):
        return "atendente_humano"

    info_indicadores = [
        "visto", "turista", "estudante", "trabalho", "imigração", "imigracao",
        "intercâmbio", "intercambio", "serviço", "servico", "quanto custa",
        "prazo", "tempo", "como funciona", "requisito", "exigência", "exigencia",
        "preço", "preco", "valor",
    ]
    if any(p in texto for p in info_indicadores):
        return "info_geral"

    return "outro"


def buscar_processos_usuario(usuario_id: int) -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, tipo, status, nome_completo, pais_destino, criado_em, atualizado_em
           FROM processos WHERE usuario_id = %s ORDER BY criado_em DESC""",
        (usuario_id,),
    )
    processos = [dict(p) for p in cur.fetchall()]
    cur.close()
    conn.close()
    return processos


def buscar_documentos_pendentes(usuario_id: int) -> list[dict]:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT sd.tipo_documento, sd.descricao, sd.obrigatoria, sd.status, p.id as processo_id, p.tipo as tipo_processo
           FROM solicitacoes_documento sd
           JOIN processos p ON sd.processo_id = p.id
           WHERE p.usuario_id = %s AND sd.status = 'pendente'
           ORDER BY sd.criado_em ASC""",
        (usuario_id,),
    )
    docs = [dict(d) for d in cur.fetchall()]
    cur.close()
    conn.close()
    return docs


def construir_contexto_usuario(usuario_id: int) -> str:
    processos = buscar_processos_usuario(usuario_id)
    if not processos:
        return "O usuário não possui nenhum processo ativo no momento."

    partes = []
    for p in processos:
        status_label = STATUS_LABELS.get(p["status"], p["status"])
        tipo_label = TIPO_VISTO_LABELS.get(p["tipo"], p["tipo"])
        explicacao = STATUS_EXPLICACOES.get(p["status"], "")

        parte = (
            f"- Processo #{p['id']}: {tipo_label} para {p['pais_destino'] or 'destino não informado'}\n"
            f"  Status atual: {status_label}\n"
            f"  Significado: {explicacao}\n"
            f"  Nome no processo: {p['nome_completo']}\n"
            f"  Criado em: {p['criado_em']}"
        )
        partes.append(parte)

    docs_pendentes = buscar_documentos_pendentes(usuario_id)
    if docs_pendentes:
        partes.append("\nDocumentos pendentes de envio:")
        for d in docs_pendentes:
            tipo_doc_label = d["tipo_documento"].replace("_", " ").title()
            partes.append(f"  - {tipo_doc_label} (Processo #{d['processo_id']}): {d['descricao'] or 'Sem descrição'}")

    # Incluir análises de prontidão (se existirem)
    try:
        conn = get_connection()
        cur = conn.cursor()
        for p in processos:
            cur.execute(
                """SELECT pontuacao, resumo_ia, documentos_faltantes, criado_em
                   FROM analises_caso WHERE processo_id = %s ORDER BY criado_em DESC LIMIT 1""",
                (p["id"],),
            )
            analise = cur.fetchone()
            if analise:
                partes.append(f"\nÚltima análise de prontidão do Processo #{p['id']}:")
                partes.append(f"  Pontuação: {analise['pontuacao']}/100")
                partes.append(f"  Resumo: {analise['resumo_ia']}")
                faltantes = analise["documentos_faltantes"]
                if faltantes:
                    labels = [d.replace("_", " ").title() for d in faltantes]
                    partes.append(f"  Documentos faltantes: {', '.join(labels)}")
        cur.close()
        conn.close()
    except Exception:
        pass

    return "\n".join(partes)


def gerar_resposta_chatbot(
    mensagem: str,
    historico_conversa: list[dict],
    usuario_id: int | None = None,
    nome_usuario: str | None = None,
) -> dict:
    if not GEMINI_API_KEY:
        raise ChatbotConfigError("GEMINI_API_KEY não configurada no backend/.env")

    intencao = classificar_intencao(mensagem)

    # Detecta idioma: prioriza o idioma detectado na mensagem do usuário;
    # cai para a preferência salva como desempate; default pt-BR.
    idioma = _detectar_idioma_mensagem(mensagem)
    if idioma is None and usuario_id:
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT idioma FROM usuarios WHERE id = %s", (usuario_id,))
            row = cur.fetchone()
            cur.close()
            conn.close()
            if row and row.get("idioma"):
                idioma = row["idioma"]
        except Exception:
            pass
    if idioma is None:
        idioma = "pt-BR"

    is_en = idioma == "en-US"

    if intencao == "atendente_humano":
        if usuario_id is None:
            return {
                "resposta": (
                    "To connect you with a human agent, I need to verify your identity first. "
                    "Please provide your email so I can send a verification code."
                    if is_en else
                    "Para conectar você com um atendente humano, preciso verificar sua identidade primeiro. "
                    "Por favor, informe seu e-mail para que eu envie um código de verificação."
                ),
                "intencao": intencao,
                "requer_auth": True,
                "requer_handoff": False,
            }
        return {
            "resposta": (
                "I'll connect you with a human agent. Please hold on a moment."
                if is_en else
                "Vou conectar você com um atendente humano. Aguarde um momento."
            ),
            "intencao": intencao,
            "requer_auth": False,
            "requer_handoff": True,
        }

    intencoes_privadas = ("status_query", "documento_query", "proximo_passo", "alteracao_dados", "analise_caso")

    if intencao in intencoes_privadas and usuario_id is None:
        return {
            "resposta": (
                "To look up information about your case, I need to verify your identity. "
                "Please provide your email so I can send a verification code."
                if is_en else
                "Para consultar informações sobre seu processo, preciso verificar sua identidade. "
                "Por favor, informe seu e-mail para que eu envie um código de verificação."
            ),
            "intencao": intencao,
            "requer_auth": True,
        }

    if intencao == "alteracao_dados":
        return {
            "resposta": (
                "I understand you want to make a change. For security, changes and cancellations "
                "must be done directly from your dashboard on the website. "
                "Go to the 'Track Case' menu to manage your data."
                if is_en else
                "Entendo que você deseja fazer uma alteração. Por segurança, alterações e "
                "cancelamentos devem ser feitos diretamente pelo seu painel no site. "
                "Acesse o menu 'Acompanhar Processo' para gerenciar seus dados."
            ),
            "intencao": intencao,
            "requer_auth": False,
        }

    system_instruction = SYSTEM_PROMPT
    # Preferência salva do usuário é apenas dica de desempate — a regra principal é
    # responder no idioma da última mensagem (definido no SYSTEM_PROMPT).
    if idioma == "en-US":
        system_instruction += (
            "\n\nTiebreaker hint: if the user's latest message is too short or "
            "ambiguous to detect a language, prefer English."
        )
    else:
        system_instruction += (
            "\n\nDica de desempate: se a última mensagem do usuário for curta ou "
            "ambígua demais para detectar o idioma, prefira português brasileiro."
        )
    if usuario_id and nome_usuario:
        contexto = construir_contexto_usuario(usuario_id)
        system_instruction += f"\n\nUSUÁRIO AUTENTICADO: {nome_usuario}\nPROCESSOS DO USUÁRIO:\n{contexto}"

    historico_truncado = historico_conversa[-20:] if len(historico_conversa) > 20 else historico_conversa

    contents = list(historico_truncado)
    contents.append({"role": "user", "parts": [{"text": mensagem}]})

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config={
            "system_instruction": system_instruction,
            "temperature": 0.7,
            "max_output_tokens": 1024,
        },
    )

    fallback_vazio = (
        "Sorry, I couldn't generate a reply. Please try again."
        if idioma == "en-US"
        else "Desculpe, não consegui gerar uma resposta. Tente novamente."
    )
    resposta_texto = response.text or fallback_vazio

    return {
        "resposta": resposta_texto,
        "intencao": intencao,
        "requer_auth": False,
    }
