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
Seu nome é Assistente YouVisa. Você fala em português brasileiro (pt-BR), de forma amigável, clara e acessível.

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


def classificar_intencao(mensagem: str) -> str:
    texto = mensagem.lower().strip()

    saudacao_palavras = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "hey", "hello", "e aí", "eai"]
    if any(texto.startswith(p) or texto == p for p in saudacao_palavras):
        return "saudacao"

    despedida_palavras = ["tchau", "até logo", "ate logo", "valeu", "obrigado", "obrigada", "flw", "bye"]
    if any(p in texto for p in despedida_palavras):
        return "despedida"

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

    intencoes_privadas = ("status_query", "documento_query", "proximo_passo", "alteracao_dados")

    if intencao in intencoes_privadas and usuario_id is None:
        return {
            "resposta": "Para consultar informações sobre seu processo, preciso verificar sua identidade. "
                        "Por favor, informe seu e-mail para que eu envie um código de verificação.",
            "intencao": intencao,
            "requer_auth": True,
        }

    if intencao == "alteracao_dados":
        return {
            "resposta": "Entendo que você deseja fazer uma alteração. Por segurança, alterações e "
                        "cancelamentos devem ser feitos diretamente pelo seu painel no site. "
                        "Acesse o menu 'Acompanhar Processo' para gerenciar seus dados.",
            "intencao": intencao,
            "requer_auth": False,
        }

    system_instruction = SYSTEM_PROMPT
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

    resposta_texto = response.text or "Desculpe, não consegui gerar uma resposta. Tente novamente."

    return {
        "resposta": resposta_texto,
        "intencao": intencao,
        "requer_auth": False,
    }
