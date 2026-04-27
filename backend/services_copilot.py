"""Copiloto de Prontidão — AI Case Readiness Agent.

Uses Gemini with function calling to orchestrate Textract, Rekognition,
and business-rule checks into a single end-to-end case readiness analysis.
"""

import json
import os
import traceback
from datetime import date, datetime

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, GEMINI_MODEL
from database import get_connection
from services_ai import (
    analisar_passaporte_textract,
    comparar_foto_com_passaporte_rekognition,
    extrair_dados_passaporte,
    _normalize_text,
)


MAX_AGENT_ITERATIONS = 10

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")

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


# ---------------------------------------------------------------------------
# Tool implementations (called by the agent)
# ---------------------------------------------------------------------------

def _tool_buscar_requisitos(tipo_visto: str, pais_destino: str) -> dict:
    """Busca os requisitos configurados para um tipo de visto e país de destino."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT documentos_obrigatorios, validade_minima_passaporte_meses, regras_adicionais
           FROM requisitos_visto
           WHERE tipo_visto = %s AND LOWER(pais_destino) = LOWER(%s) AND ativo = TRUE""",
        (tipo_visto, pais_destino),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if row:
        return {
            "encontrado": True,
            "documentos_obrigatorios": row["documentos_obrigatorios"],
            "validade_minima_passaporte_meses": row["validade_minima_passaporte_meses"],
            "regras_adicionais": row["regras_adicionais"] or {},
        }

    # Requisitos padrão quando não há configuração específica
    return {
        "encontrado": False,
        "documentos_obrigatorios": ["passaporte", "foto"],
        "validade_minima_passaporte_meses": 6,
        "regras_adicionais": {},
        "nota": "Nenhum requisito específico configurado para esta combinação. Usando requisitos padrão.",
    }


def _tool_verificar_completude(documentos_enviados: list[str], documentos_obrigatorios: list[str]) -> dict:
    """Compara documentos enviados com documentos obrigatórios."""
    enviados_set = set(documentos_enviados)
    obrigatorios_set = set(documentos_obrigatorios)

    presentes = sorted(enviados_set & obrigatorios_set)
    faltantes = sorted(obrigatorios_set - enviados_set)
    extras = sorted(enviados_set - obrigatorios_set)

    total_obrigatorios = len(obrigatorios_set)
    total_presentes = len(presentes)
    percentual = round((total_presentes / total_obrigatorios * 100) if total_obrigatorios > 0 else 100)

    return {
        "completo": len(faltantes) == 0,
        "percentual_completude": percentual,
        "documentos_presentes": [TIPO_DOCUMENTO_LABELS.get(d, d) for d in presentes],
        "documentos_faltantes": [TIPO_DOCUMENTO_LABELS.get(d, d) for d in faltantes],
        "documentos_faltantes_ids": faltantes,
        "documentos_extras": [TIPO_DOCUMENTO_LABELS.get(d, d) for d in extras],
    }


def _tool_analisar_passaporte(caminho_arquivo: str, nome_esperado: str,
                               data_nascimento: str | None, data_validade: str | None) -> dict:
    """Analisa passaporte usando Amazon Textract."""
    try:
        data_nasc = date.fromisoformat(data_nascimento) if data_nascimento else None
        data_val = date.fromisoformat(data_validade) if data_validade else None

        resultado = analisar_passaporte_textract(caminho_arquivo, nome_esperado, data_nasc, data_val)
        return resultado
    except Exception as exc:
        return {"status": "erro", "detalhes": str(exc)}


def _tool_comparar_foto(caminho_foto: str, caminho_passaporte: str) -> dict:
    """Compara foto com passaporte usando Amazon Rekognition."""
    try:
        resultado = comparar_foto_com_passaporte_rekognition(caminho_foto, caminho_passaporte)
        return resultado
    except Exception as exc:
        return {"status": "erro", "detalhes": str(exc)}


def _tool_verificar_validade_passaporte(data_expiracao: str, meses_minimos: int) -> dict:
    """Verifica se a validade do passaporte atende ao mínimo exigido."""
    try:
        expiracao = date.fromisoformat(data_expiracao)
        hoje = date.today()

        dias_restantes = (expiracao - hoje).days
        meses_restantes = dias_restantes / 30.44  # média de dias por mês

        valido = meses_restantes >= meses_minimos

        if expiracao <= hoje:
            return {
                "valido": False,
                "mensagem": f"Passaporte EXPIRADO desde {expiracao.strftime('%d/%m/%Y')}",
                "dias_restantes": dias_restantes,
                "meses_restantes": round(meses_restantes, 1),
                "meses_minimos": meses_minimos,
            }

        return {
            "valido": valido,
            "mensagem": (
                f"Passaporte válido por mais {round(meses_restantes, 1)} meses ({dias_restantes} dias). "
                f"{'Atende' if valido else 'NÃO atende'} ao mínimo de {meses_minimos} meses."
            ),
            "dias_restantes": dias_restantes,
            "meses_restantes": round(meses_restantes, 1),
            "meses_minimos": meses_minimos,
        }
    except Exception as exc:
        return {"status": "erro", "detalhes": str(exc)}


def _tool_verificar_consistencia(dados_processo: dict, dados_extraidos: dict) -> dict:
    """Verifica consistência entre dados informados pelo usuário e extraídos por IA."""
    inconsistencias = []
    conferencias = []

    # Nome
    nome_processo = _normalize_text(dados_processo.get("nome_completo", ""))
    nome_extraido = _normalize_text(dados_extraidos.get("nome_completo", ""))

    if nome_processo and nome_extraido:
        if nome_processo == nome_extraido:
            conferencias.append("Nome completo confere com o passaporte")
        else:
            inconsistencias.append(
                f"Nome divergente — Informado: '{dados_processo.get('nome_completo')}' | "
                f"Passaporte: '{dados_extraidos.get('nome_completo')}'"
            )
    elif nome_processo and not nome_extraido:
        inconsistencias.append("Não foi possível extrair o nome do passaporte para comparação")

    # Data de nascimento
    nasc_processo = dados_processo.get("data_nascimento")
    nasc_extraido = dados_extraidos.get("data_nascimento")
    if nasc_processo and nasc_extraido:
        if nasc_processo == nasc_extraido:
            conferencias.append("Data de nascimento confere com o passaporte")
        else:
            inconsistencias.append(
                f"Data de nascimento divergente — Informada: {nasc_processo} | Passaporte: {nasc_extraido}"
            )

    # Data de validade
    val_processo = dados_processo.get("data_expiracao_passaporte")
    val_extraido = dados_extraidos.get("data_expiracao_passaporte")
    if val_processo and val_extraido:
        if val_processo == val_extraido:
            conferencias.append("Data de expiração do passaporte confere")
        else:
            inconsistencias.append(
                f"Data de expiração divergente — Informada: {val_processo} | Passaporte: {val_extraido}"
            )

    # Número do passaporte
    pass_processo = _normalize_text(dados_processo.get("passaporte", ""))
    pass_extraido = _normalize_text(dados_extraidos.get("passaporte", ""))
    if pass_processo and pass_extraido:
        if pass_processo == pass_extraido:
            conferencias.append("Número do passaporte confere")
        else:
            inconsistencias.append(
                f"Número de passaporte divergente — Informado: {dados_processo.get('passaporte')} | "
                f"Passaporte: {dados_extraidos.get('passaporte')}"
            )

    return {
        "consistente": len(inconsistencias) == 0,
        "conferencias": conferencias,
        "inconsistencias": inconsistencias,
    }


# ---------------------------------------------------------------------------
# Gemini Function Declarations
# ---------------------------------------------------------------------------

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="buscar_requisitos",
        description="Busca os requisitos de documentação e validade configurados para um tipo de visto e país de destino específicos.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "tipo_visto": types.Schema(type="STRING", description="Tipo de visto (ex: visto_turista, visto_estudante)"),
                "pais_destino": types.Schema(type="STRING", description="País de destino (ex: Estados Unidos, Canadá)"),
            },
            required=["tipo_visto", "pais_destino"],
        ),
    ),
    types.FunctionDeclaration(
        name="verificar_completude",
        description="Verifica quais documentos obrigatórios foram enviados e quais estão faltando.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "documentos_enviados": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                    description="Lista de tipos de documentos enviados pelo usuário",
                ),
                "documentos_obrigatorios": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                    description="Lista de tipos de documentos obrigatórios para este visto",
                ),
            },
            required=["documentos_enviados", "documentos_obrigatorios"],
        ),
    ),
    types.FunctionDeclaration(
        name="analisar_passaporte",
        description="Analisa a imagem do passaporte usando IA (Amazon Textract) para extrair e validar dados como nome, data de nascimento e data de validade.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "caminho_arquivo": types.Schema(type="STRING", description="Caminho do arquivo de passaporte no servidor"),
                "nome_esperado": types.Schema(type="STRING", description="Nome completo esperado (informado pelo usuário)"),
                "data_nascimento": types.Schema(type="STRING", description="Data de nascimento esperada (ISO format: YYYY-MM-DD)"),
                "data_validade": types.Schema(type="STRING", description="Data de validade esperada do passaporte (ISO format: YYYY-MM-DD)"),
            },
            required=["caminho_arquivo", "nome_esperado"],
        ),
    ),
    types.FunctionDeclaration(
        name="comparar_foto",
        description="Compara a foto 3x4 enviada com a foto do passaporte usando IA (Amazon Rekognition) para verificar se são da mesma pessoa.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "caminho_foto": types.Schema(type="STRING", description="Caminho da foto 3x4 no servidor"),
                "caminho_passaporte": types.Schema(type="STRING", description="Caminho da imagem do passaporte no servidor"),
            },
            required=["caminho_foto", "caminho_passaporte"],
        ),
    ),
    types.FunctionDeclaration(
        name="verificar_validade_passaporte",
        description="Verifica se a data de expiração do passaporte atende ao prazo mínimo exigido pelo país de destino.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "data_expiracao": types.Schema(type="STRING", description="Data de expiração do passaporte (ISO format: YYYY-MM-DD)"),
                "meses_minimos": types.Schema(type="INTEGER", description="Quantidade mínima de meses de validade exigida"),
            },
            required=["data_expiracao", "meses_minimos"],
        ),
    ),
    types.FunctionDeclaration(
        name="verificar_consistencia",
        description="Verifica a consistência entre os dados informados pelo usuário (nome, nascimento, passaporte) e os dados extraídos do documento pelo Textract.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "dados_processo": types.Schema(
                    type="OBJECT",
                    description="Dados informados pelo usuário no processo",
                    properties={
                        "nome_completo": types.Schema(type="STRING"),
                        "data_nascimento": types.Schema(type="STRING"),
                        "data_expiracao_passaporte": types.Schema(type="STRING"),
                        "passaporte": types.Schema(type="STRING"),
                    },
                ),
                "dados_extraidos": types.Schema(
                    type="OBJECT",
                    description="Dados extraídos do passaporte pela IA (Textract)",
                    properties={
                        "nome_completo": types.Schema(type="STRING"),
                        "data_nascimento": types.Schema(type="STRING"),
                        "data_expiracao_passaporte": types.Schema(type="STRING"),
                        "passaporte": types.Schema(type="STRING"),
                    },
                ),
            },
            required=["dados_processo", "dados_extraidos"],
        ),
    ),
    types.FunctionDeclaration(
        name="gerar_relatorio",
        description="Gera o relatório final de prontidão do caso. Chame esta função SOMENTE quando todas as verificações necessárias tiverem sido concluídas.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "pontuacao": types.Schema(type="INTEGER", description="Pontuação de prontidão de 0 a 100"),
                "itens": types.Schema(
                    type="ARRAY",
                    description="Lista de itens verificados",
                    items=types.Schema(
                        type="OBJECT",
                        properties={
                            "categoria": types.Schema(type="STRING", description="Categoria: completude, passaporte, foto, validade, consistencia"),
                            "descricao": types.Schema(type="STRING", description="Descrição do que foi verificado"),
                            "status": types.Schema(type="STRING", description="Resultado: aprovado, reprovado, ou alerta"),
                            "detalhes": types.Schema(type="STRING", description="Detalhes adicionais"),
                        },
                        required=["categoria", "descricao", "status", "detalhes"],
                    ),
                ),
                "resumo": types.Schema(type="STRING", description="Resumo em linguagem natural para o administrador"),
                "documentos_faltantes": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                    description="Lista de tipos de documentos faltantes",
                ),
                "alertas": types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                    description="Lista de alertas e avisos importantes",
                ),
            },
            required=["pontuacao", "itens", "resumo", "documentos_faltantes", "alertas"],
        ),
    ),
]

TOOL_DISPATCH = {
    "buscar_requisitos": lambda args: _tool_buscar_requisitos(args["tipo_visto"], args["pais_destino"]),
    "verificar_completude": lambda args: _tool_verificar_completude(args["documentos_enviados"], args["documentos_obrigatorios"]),
    "analisar_passaporte": lambda args: _tool_analisar_passaporte(
        args["caminho_arquivo"], args["nome_esperado"],
        args.get("data_nascimento"), args.get("data_validade"),
    ),
    "comparar_foto": lambda args: _tool_comparar_foto(args["caminho_foto"], args["caminho_passaporte"]),
    "verificar_validade_passaporte": lambda args: _tool_verificar_validade_passaporte(
        args["data_expiracao"], args["meses_minimos"],
    ),
    "verificar_consistencia": lambda args: _tool_verificar_consistencia(args["dados_processo"], args["dados_extraidos"]),
    "gerar_relatorio": lambda args: args,  # passthrough — the args ARE the report
}


# ---------------------------------------------------------------------------
# Agent system prompt
# ---------------------------------------------------------------------------

COPILOT_SYSTEM_PROMPT = """Você é o Copiloto de Prontidão da YouVisa — um agente de IA especializado em avaliar se um caso de visto está pronto para submissão.

Seu trabalho é analisar TODOS os aspectos de um caso de visto de forma metódica e produzir um relatório de prontidão completo.

## FLUXO DE ANÁLISE OBRIGATÓRIO

Siga estas etapas na ordem:

1. **Buscar Requisitos**: Use `buscar_requisitos` para descobrir quais documentos e regras se aplicam a este tipo de visto e país.

2. **Verificar Completude**: Use `verificar_completude` para comparar os documentos enviados com os obrigatórios.

3. **Analisar Passaporte** (se houver documento de passaporte): Use `analisar_passaporte` para validar os dados extraídos via Textract.

4. **Comparar Foto** (se houver foto E passaporte): Use `comparar_foto` para verificar se a foto confere com o passaporte.

5. **Verificar Validade do Passaporte**: Use `verificar_validade_passaporte` para confirmar que a validade atende ao mínimo exigido.

6. **Verificar Consistência**: Se o passaporte foi analisado, use os dados extraídos para verificar consistência com o que o usuário informou. Use as informações retornadas pela análise do passaporte como `dados_extraidos`.

7. **Gerar Relatório**: Após TODAS as verificações, chame `gerar_relatorio` com a pontuação, itens, resumo, documentos faltantes e alertas.

## REGRAS DE PONTUAÇÃO

- Comece com 100 pontos
- Documento obrigatório faltante: -20 pontos por documento
- Passaporte reprovado pelo Textract: -25 pontos
- Foto reprovada pelo Rekognition: -15 pontos
- Validade do passaporte insuficiente: -20 pontos
- Inconsistência de dados: -10 pontos por inconsistência
- Erro em verificação (serviço indisponível): -5 pontos (e registre como alerta)
- Mínimo: 0 pontos

## REGRAS PARA O RESUMO

- Escreva em português brasileiro (pt-BR)
- Use linguagem profissional mas acessível
- Seja objetivo e direto
- Destaque os pontos críticos que impedem a submissão
- Se tudo estiver ok, confirme com confiança

## REGRAS IMPORTANTES

- Se um serviço (Textract, Rekognition) retornar erro, registre como alerta e continue as demais verificações
- SEMPRE chame `gerar_relatorio` ao final — esta é a única forma de encerrar a análise
- Não invente dados — use apenas o que as ferramentas retornaram
"""


# ---------------------------------------------------------------------------
# Data loading helpers
# ---------------------------------------------------------------------------

def _carregar_dados_caso(processo_id: int) -> dict:
    """Carrega todos os dados de um processo para análise."""
    conn = get_connection()
    cur = conn.cursor()

    # Processo
    cur.execute(
        """SELECT id, usuario_id, tipo, status, nome_completo, data_nascimento,
                  passaporte, data_expiracao_passaporte, pais_destino, criado_em
           FROM processos WHERE id = %s""",
        (processo_id,),
    )
    processo = cur.fetchone()
    if not processo:
        cur.close()
        conn.close()
        raise ValueError(f"Processo #{processo_id} não encontrado")

    processo = dict(processo)
    # Serialise date/datetime fields
    for key in ("data_nascimento", "data_expiracao_passaporte", "criado_em"):
        val = processo.get(key)
        if isinstance(val, (date, datetime)):
            processo[key] = val.isoformat()

    # Documentos
    cur.execute(
        """SELECT id, nome_original, nome_arquivo, tipo_documento, tipo_arquivo,
                  tamanho, status, feedback
           FROM documentos WHERE processo_id = %s ORDER BY criado_em ASC""",
        (processo_id,),
    )
    documentos = [dict(d) for d in cur.fetchall()]

    # Solicitações de documento
    cur.execute(
        """SELECT tipo_documento, descricao, obrigatoria, status
           FROM solicitacoes_documento WHERE processo_id = %s ORDER BY criado_em ASC""",
        (processo_id,),
    )
    solicitacoes = [dict(s) for s in cur.fetchall()]

    cur.close()
    conn.close()

    # Resolver caminhos dos arquivos
    for doc in documentos:
        doc["caminho"] = os.path.join(UPLOAD_DIR, doc["nome_arquivo"])
        doc["arquivo_existe"] = os.path.exists(doc["caminho"])

    return {
        "processo": processo,
        "documentos": documentos,
        "solicitacoes": solicitacoes,
    }


def _salvar_analise(processo_id: int, funcionario_id: int, relatorio: dict) -> dict:
    """Persiste o relatório de análise no banco de dados."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO analises_caso (processo_id, pontuacao, itens, resumo_ia,
                                       documentos_faltantes, alertas, analisado_por)
           VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, criado_em""",
        (
            processo_id,
            relatorio["pontuacao"],
            json.dumps(relatorio["itens"], ensure_ascii=False),
            relatorio["resumo"],
            json.dumps(relatorio["documentos_faltantes"], ensure_ascii=False),
            json.dumps(relatorio["alertas"], ensure_ascii=False),
            funcionario_id,
        ),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return {
        "id": row["id"],
        "processo_id": processo_id,
        "pontuacao": relatorio["pontuacao"],
        "itens": relatorio["itens"],
        "resumo_ia": relatorio["resumo"],
        "documentos_faltantes": relatorio["documentos_faltantes"],
        "alertas": relatorio["alertas"],
        "analisado_por": funcionario_id,
        "criado_em": row["criado_em"].isoformat() if isinstance(row["criado_em"], (date, datetime)) else str(row["criado_em"]),
    }


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

def executar_analise_caso(processo_id: int, funcionario_id: int) -> dict:
    """Executa a análise completa de prontidão de um caso usando o agente Gemini."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY não configurada no backend/.env")

    # 1. Carregar dados do caso
    caso = _carregar_dados_caso(processo_id)
    processo = caso["processo"]
    documentos = caso["documentos"]

    # 2. Construir mensagem inicial para o agente
    tipos_enviados = [d["tipo_documento"] for d in documentos]
    docs_resumo = []
    for d in documentos:
        label = TIPO_DOCUMENTO_LABELS.get(d["tipo_documento"], d["tipo_documento"])
        status_doc = d.get("status", "pendente_revisao")
        docs_resumo.append(
            f"  - {label} (id={d['id']}, arquivo={d['nome_arquivo']}, "
            f"caminho={d['caminho']}, status={status_doc})"
        )

    mensagem_caso = f"""Analise o seguinte caso de visto:

PROCESSO #{processo['id']}
- Tipo de visto: {processo['tipo']}
- Status atual: {processo['status']}
- País de destino: {processo['pais_destino'] or 'Não informado'}
- Nome completo: {processo['nome_completo']}
- Data de nascimento: {processo['data_nascimento'] or 'Não informada'}
- Passaporte: {processo['passaporte'] or 'Não informado'}
- Data de expiração do passaporte: {processo['data_expiracao_passaporte'] or 'Não informada'}
- Criado em: {processo['criado_em']}

DOCUMENTOS ENVIADOS ({len(documentos)} arquivo(s)):
{chr(10).join(docs_resumo) if docs_resumo else '  Nenhum documento enviado'}

Tipos de documento enviados: {', '.join(tipos_enviados) if tipos_enviados else 'nenhum'}

Realize todas as verificações aplicáveis e gere o relatório final de prontidão."""

    # 3. Configurar Gemini
    client = genai.Client(api_key=GEMINI_API_KEY)

    tools = types.Tool(function_declarations=TOOL_DECLARATIONS)

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=mensagem_caso)],
        )
    ]

    # 4. Agent loop
    relatorio = None

    for iteration in range(MAX_AGENT_ITERATIONS):
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=COPILOT_SYSTEM_PROMPT,
                tools=[tools],
                temperature=0.2,
                max_output_tokens=4096,
            ),
        )

        # Check for function calls
        function_calls = []
        text_parts = []
        for part in response.candidates[0].content.parts:
            if part.function_call:
                function_calls.append(part.function_call)
            elif part.text:
                text_parts.append(part.text)

        if not function_calls:
            # No function calls — agent is done (or stuck)
            break

        # Add the model's response to contents
        contents.append(response.candidates[0].content)

        # Execute each function call and collect responses
        function_response_parts = []
        for fc in function_calls:
            fn_name = fc.name
            fn_args = dict(fc.args) if fc.args else {}

            print(f"[COPILOT] Iteration {iteration + 1}: calling {fn_name}({json.dumps(fn_args, ensure_ascii=False)[:200]})")

            try:
                handler = TOOL_DISPATCH.get(fn_name)
                if not handler:
                    result = {"status": "erro", "detalhes": f"Função '{fn_name}' não encontrada"}
                else:
                    result = handler(fn_args)
            except Exception as exc:
                print(f"[COPILOT] Error in {fn_name}: {traceback.format_exc()}")
                result = {"status": "erro", "detalhes": str(exc)}

            # Check if this is the final report
            if fn_name == "gerar_relatorio" and "status" not in result:
                relatorio = result

            function_response_parts.append(
                types.Part.from_function_response(
                    name=fn_name,
                    response=result,
                )
            )

        contents.append(
            types.Content(
                role="user",
                parts=function_response_parts,
            )
        )

        if relatorio is not None:
            break

    # 5. If agent didn't call gerar_relatorio, build a fallback report
    if relatorio is None:
        relatorio = {
            "pontuacao": 0,
            "itens": [
                {
                    "categoria": "sistema",
                    "descricao": "Análise incompleta",
                    "status": "alerta",
                    "detalhes": "O agente IA não conseguiu completar a análise. Tente novamente ou revise manualmente.",
                }
            ],
            "resumo": "A análise automatizada não pôde ser concluída. Por favor, revise o caso manualmente.",
            "documentos_faltantes": [],
            "alertas": ["Análise IA incompleta — requer revisão manual"],
        }

    # 6. Persist and return
    return _salvar_analise(processo_id, funcionario_id, relatorio)


def buscar_ultima_analise(processo_id: int) -> dict | None:
    """Retorna a análise mais recente de um processo."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, processo_id, pontuacao, itens, resumo_ia,
                  documentos_faltantes, alertas, analisado_por, criado_em
           FROM analises_caso
           WHERE processo_id = %s
           ORDER BY criado_em DESC LIMIT 1""",
        (processo_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return None

    row = dict(row)
    if isinstance(row["criado_em"], (date, datetime)):
        row["criado_em"] = row["criado_em"].isoformat()

    return row
