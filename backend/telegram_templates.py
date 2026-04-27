"""Templates de mensagens Telegram para o YouVisa Bot."""

from services import STATUS_LABELS, STATUS_CORES, STATUS_MENSAGENS, TIPO_VISTO_LABELS, TIPO_DOCUMENTO_LABELS


def template_boas_vindas(vinculado: bool, nome_usuario: str | None = None) -> str:
    if vinculado and nome_usuario:
        return (
            f"🎉 *Conta conectada com sucesso!*\n\n"
            f"Olá, {nome_usuario}! Sua conta YouVisa foi conectada ao Telegram.\n\n"
            f"Agora você pode:\n"
            f"📊 /status — Ver seus processos\n"
            f"📄 /documentos — Ver documentos pendentes\n"
            f"📎 /enviar — Enviar um documento\n"
            f"👤 /atendente — Falar com atendente\n"
            f"❓ /ajuda — Ver todos os comandos\n\n"
            f"Ou simplesmente me envie uma mensagem e eu respondo como assistente virtual!"
        )
    return (
        "👋 *Bem-vindo ao YouVisa Bot!*\n\n"
        "Sou o assistente virtual da YouVisa, agência de imigração.\n\n"
        "Posso responder suas dúvidas sobre vistos e serviços.\n\n"
        "Para acessar informações do seu processo, conecte sua conta:\n"
        "1️⃣ Acesse seu painel em youvisa.com\n"
        "2️⃣ Clique em \"Conectar Telegram\"\n"
        "3️⃣ Use o link gerado para conectar\n\n"
        "Enquanto isso, pode me perguntar qualquer coisa sobre nossos serviços!"
    )


def template_ajuda() -> str:
    return (
        "📋 *Comandos disponíveis:*\n\n"
        "📊 /status — Ver status dos seus processos\n"
        "📄 /documentos — Ver documentos pendentes\n"
        "📎 /enviar — Enviar um documento\n"
        "👤 /atendente — Solicitar atendimento humano\n"
        "🔗 /desconectar — Desconectar sua conta\n"
        "❓ /ajuda — Ver esta mensagem\n\n"
        "Você também pode enviar mensagens de texto e eu respondo como assistente virtual!"
    )


def template_nao_vinculado() -> str:
    return (
        "🔒 Você precisa conectar sua conta YouVisa para usar este recurso.\n\n"
        "Acesse seu painel em youvisa.com, clique em \"Conectar Telegram\" e use o link gerado."
    )


def template_mudanca_status(
    nome_usuario: str,
    tipo_processo: str,
    processo_id: int,
    status_anterior: str,
    status_novo: str,
    observacao: str | None = None,
) -> str:
    cor = STATUS_CORES.get(status_novo, STATUS_CORES["recebido"])
    msg = STATUS_MENSAGENS.get(status_novo, {"titulo": f"Status atualizado", "descricao": ""})
    label_anterior = STATUS_LABELS.get(status_anterior, status_anterior)
    label_novo = STATUS_LABELS.get(status_novo, status_novo)
    label_tipo = TIPO_VISTO_LABELS.get(tipo_processo, tipo_processo)

    texto = (
        f"{cor['icon']} *{msg['titulo']}*\n\n"
        f"Olá, {nome_usuario}!\n\n"
        f"📋 *Processo #{processo_id}* — {label_tipo}\n"
        f"⬅️ Status anterior: {label_anterior}\n"
        f"➡️ Novo status: *{label_novo}*\n\n"
        f"{msg['descricao']}"
    )

    if observacao:
        texto += f"\n\n💬 *Observação da equipe:*\n{observacao}"

    texto += "\n\nAcesse seu painel para mais detalhes."
    return texto


def template_documentos_solicitados(
    nome_usuario: str,
    tipo_processo: str,
    processo_id: int,
    documentos: list[dict],
) -> str:
    label_tipo = TIPO_VISTO_LABELS.get(tipo_processo, tipo_processo)

    itens = ""
    for doc in documentos:
        label = TIPO_DOCUMENTO_LABELS.get(doc["tipo_documento"], doc["tipo_documento"])
        desc = f" — {doc['descricao']}" if doc.get("descricao") else ""
        itens += f"  📄 {label}{desc}\n"

    return (
        f"📋 *Documentos Solicitados*\n\n"
        f"Olá, {nome_usuario}!\n\n"
        f"Nossa equipe precisa dos seguintes documentos para o processo #{processo_id} ({label_tipo}):\n\n"
        f"{itens}\n"
        f"Você pode enviá-los pelo comando /enviar ou pelo painel web."
    )


def template_upload_confirmacao(tipo_documento: str, processo_id: int) -> str:
    label = TIPO_DOCUMENTO_LABELS.get(tipo_documento, tipo_documento)
    return f"✅ Documento *{label}* enviado com sucesso para o processo #{processo_id}!"


def template_handoff_criado() -> str:
    return (
        "👤 *Solicitação de atendimento registrada!*\n\n"
        "Um atendente irá assumir sua conversa em breve. "
        "Enquanto isso, todas as suas mensagens serão encaminhadas diretamente para a equipe.\n\n"
        "Para voltar ao chatbot automático, aguarde o atendente encerrar o atendimento."
    )


def template_handoff_admin_entrou(nome_funcionario: str) -> str:
    return (
        f"👤 *{nome_funcionario}* assumiu seu atendimento.\n\n"
        f"Agora suas mensagens serão respondidas diretamente por um atendente."
    )


def template_handoff_encerrado() -> str:
    return (
        "✅ *Atendimento encerrado.*\n\n"
        "Obrigado pelo contato! Suas mensagens agora serão respondidas pelo assistente virtual novamente.\n\n"
        "Se precisar de ajuda novamente, use /atendente."
    )


def template_status_processos(processos: list[dict]) -> str:
    if not processos:
        return "📊 Você não possui processos ativos no momento."

    linhas = ["📊 *Seus Processos:*\n"]
    for p in processos:
        cor = STATUS_CORES.get(p["status"], STATUS_CORES["recebido"])
        label_status = STATUS_LABELS.get(p["status"], p["status"])
        label_tipo = TIPO_VISTO_LABELS.get(p["tipo"], p["tipo"])
        destino = p.get("pais_destino") or "não informado"
        linhas.append(
            f"{cor['icon']} *Processo #{p['id']}*\n"
            f"  Tipo: {label_tipo}\n"
            f"  Destino: {destino}\n"
            f"  Status: *{label_status}*\n"
        )
    return "\n".join(linhas)


def template_documentos_pendentes(docs: list[dict]) -> str:
    if not docs:
        return "📄 Nenhum documento pendente no momento. Tudo certo!"

    linhas = ["📄 *Documentos Pendentes:*\n"]
    for d in docs:
        label = d["tipo_documento"].replace("_", " ").title()
        tipo_proc = TIPO_VISTO_LABELS.get(d.get("tipo_processo", ""), "")
        desc = f" — {d['descricao']}" if d.get("descricao") else ""
        linhas.append(f"  📎 {label} (Processo #{d['processo_id']}{', ' + tipo_proc if tipo_proc else ''}){desc}")
    linhas.append("\nUse /enviar para enviar um documento.")
    return "\n".join(linhas)
