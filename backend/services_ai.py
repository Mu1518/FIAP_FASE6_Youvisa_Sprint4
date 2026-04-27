import io
import os
import re
import unicodedata
from datetime import date, datetime
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image

from config import AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN

SIMILARIDADE_MINIMA_FOTO = 80.0

# MRZ line pattern: 44 chars of uppercase letters, digits, and '<'
_MRZ_LINE_RE = re.compile(r"^[A-Z0-9<]{30,44}$")


class AIAnalysisError(Exception):
    """Erro de integração com serviços de IA da AWS."""


class AIValidationError(Exception):
    """Erro de validação de regra de negócio na análise de IA."""


class AIServiceConfigurationError(Exception):
    """Erro de configuração local para uso da IA."""


MONTH_ALIASES: dict[str, int] = {
    "JAN": 1,
    "FEV": 2,
    "FEB": 2,
    "MAR": 3,
    "ABR": 4,
    "APR": 4,
    "MAI": 5,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AGO": 8,
    "AUG": 8,
    "SET": 9,
    "SEP": 9,
    "OUT": 10,
    "OCT": 10,
    "NOV": 11,
    "DEZ": 12,
    "DEC": 12,
}

TEXTRACT_DEBUG = os.getenv("TEXTRACT_DEBUG", "false").strip().lower() == "true"


def _load_document_bytes(caminho_arquivo: str) -> bytes:
    with open(caminho_arquivo, "rb") as file:
        return file.read()


def _build_aws_client(service_name: str):
    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        raise AIServiceConfigurationError(
            "Credenciais AWS não configuradas. Defina AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no backend/.env"
        )

    client_kwargs: dict[str, str] = {
        "service_name": service_name,
        "region_name": AWS_REGION,
        "aws_access_key_id": AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": AWS_SECRET_ACCESS_KEY,
    }
    if AWS_SESSION_TOKEN:
        client_kwargs["aws_session_token"] = AWS_SESSION_TOKEN

    return boto3.client(**client_kwargs)


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFD", value)
    without_accent = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", without_accent).strip().upper()


def _is_expected_key(normalized_key: str, aliases: tuple[str, ...]) -> bool:
    return any(alias in normalized_key for alias in aliases)


def _get_text_from_block(block: dict[str, Any], block_map: dict[str, dict[str, Any]]) -> str:
    words: list[str] = []
    for relation in block.get("Relationships", []):
        if relation.get("Type") != "CHILD":
            continue
        for child_id in relation.get("Ids", []):
            child = block_map.get(child_id, {})
            child_type = child.get("BlockType")
            if child_type == "WORD":
                words.append(child.get("Text", ""))
            elif child_type == "SELECTION_ELEMENT":
                words.append(child.get("SelectionStatus", ""))
    return " ".join(w for w in words if w).strip()


def _extract_forms_key_values(blocks: list[dict[str, Any]]) -> dict[str, str]:
    block_map = {block.get("Id"): block for block in blocks if block.get("Id")}
    key_values: dict[str, str] = {}

    for block in blocks:
        if block.get("BlockType") != "KEY_VALUE_SET":
            continue
        if "KEY" not in block.get("EntityTypes", []):
            continue

        key_text = _get_text_from_block(block, block_map)
        if not key_text:
            continue

        value_text = ""
        for relation in block.get("Relationships", []):
            if relation.get("Type") != "VALUE":
                continue
            for value_id in relation.get("Ids", []):
                value_block = block_map.get(value_id, {})
                value_text = _get_text_from_block(value_block, block_map)
                if value_text:
                    break
            if value_text:
                break

        if value_text:
            key_values[_normalize_text(key_text)] = value_text.strip()

    return key_values


def _extract_query_results(blocks: list[dict[str, Any]]) -> dict[str, str]:
    block_map = {block.get("Id"): block for block in blocks if block.get("Id")}
    results: dict[str, str] = {}

    for block in blocks:
        if block.get("BlockType") != "QUERY":
            continue

        alias = _normalize_text(block.get("Query", {}).get("Alias", ""))
        query_text = _normalize_text(block.get("Query", {}).get("Text", ""))
        key = alias or query_text
        if not key:
            continue

        answer = ""
        for relation in block.get("Relationships", []):
            if relation.get("Type") != "ANSWER":
                continue
            for answer_id in relation.get("Ids", []):
                answer_block = block_map.get(answer_id, {})
                answer = (answer_block.get("Text") or "").strip()
                if answer:
                    break
            if answer:
                break

        if answer:
            results[key] = answer

    return results


def _extract_analyze_id_fields(textract_client: Any, document_bytes: bytes) -> dict[str, str]:
    try:
        response = textract_client.analyze_id(DocumentPages=[{"Bytes": document_bytes}])
    except (ClientError, BotoCoreError):
        return {}

    documents = response.get("IdentityDocuments", [])
    if not documents:
        return {}

    fields = documents[0].get("IdentityDocumentFields", [])
    values: dict[str, str] = {}
    for field in fields:
        key = _normalize_text(field.get("Type", {}).get("Text", ""))
        value = (field.get("ValueDetection", {}).get("Text", "") or "").strip()
        if key and value:
            values[key] = value

    return values


def _extract_lines_from_blocks(blocks: list[dict[str, Any]]) -> list[str]:
    return [
        (block.get("Text") or "").strip()
        for block in blocks
        if block.get("BlockType") == "LINE" and (block.get("Text") or "").strip()
    ]


def _find_by_aliases(values: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    for key, value in values.items():
        if _is_expected_key(key, aliases) and value:
            return value
    return None


def _extract_expiration_date(text: str) -> date | None:
    dates = _extract_dates(text)
    return dates[-1] if dates else None


def _extract_dates(text: str) -> list[date]:
    found: list[date] = []
    numeric_patterns = [
        r"(\d{2}[/-]\d{2}[/-]\d{4})",
        r"(\d{4}[/-]\d{2}[/-]\d{2})",
    ]

    for pattern in numeric_patterns:
        for raw in re.findall(pattern, text):
            parsed: date | None = None
            try:
                if len(raw.split("/")[0]) == 4 or len(raw.split("-")[0]) == 4:
                    parsed = datetime.strptime(raw.replace("/", "-"), "%Y-%m-%d").date()
                else:
                    parsed = datetime.strptime(raw.replace("/", "-"), "%d-%m-%Y").date()
            except ValueError:
                parsed = None

            if parsed and parsed not in found:
                found.append(parsed)

    normalized_text = _normalize_text(text)
    # Example from Textract forms: "06 JAN/JAN 1980"
    month_pattern = re.compile(r"(\d{1,2})\s+([A-Z]{3})(?:/[A-Z]{3})?\s+(\d{4})")
    for day_str, month_alias, year_str in month_pattern.findall(normalized_text):
        month = MONTH_ALIASES.get(month_alias)
        if not month:
            continue
        try:
            parsed = date(int(year_str), month, int(day_str))
        except ValueError:
            continue
        if parsed not in found:
            found.append(parsed)

    return found


def _extract_date_from_lines_by_keywords(lines: list[str], keywords: tuple[str, ...]) -> date | None:
    for line in lines:
        normalized_line = _normalize_text(line)
        if any(keyword in normalized_line for keyword in keywords):
            dates = _extract_dates(line)
            if dates:
                return dates[0]
    return None


def _extract_date_from_values(values: dict[str, str], aliases: tuple[str, ...]) -> date | None:
    value = _find_by_aliases(values, aliases)
    if not value:
        return None
    dates = _extract_dates(value)
    return dates[0] if dates else None


def _extract_name_candidate(lines: list[str]) -> str | None:
    blocked_words = (
        "PASSPORT",
        "REPUBLIC",
        "NACIONALIDADE",
        "NATIONALITY",
        "BIRTH",
        "EXPIR",
        "DATE",
        "DOCUMENT",
        "ASSINATURA",
        "SIGNATURE",
        "AUTORIDADE",
    )

    candidates: list[str] = []
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        normalized = _normalize_text(line)
        if any(word in normalized for word in blocked_words):
            continue

        words = [w for w in normalized.split(" ") if w]
        if len(words) < 2:
            continue
        if any(any(ch.isdigit() for ch in word) for word in words):
            continue
        if len(normalized) > 80:
            continue

        candidates.append(line)

    if not candidates:
        return None

    return max(candidates, key=len)


def _format_date_br(value: date | None) -> str:
    if not value:
        return "não identificado"
    return value.strftime("%d/%m/%Y")


def _validar_mrz_passaporte(linhas: list[str]) -> dict:
    """Validate the Machine Readable Zone (MRZ) of a passport.

    A valid passport MRZ has exactly 2 lines of 44 characters each.
    Line 1 starts with 'P' and contains the issuing country code (positions 2-5).
    Returns a dict with 'valido', 'motivo', and 'mrz_linhas'.
    """
    # Normalize: strip spaces, replace common OCR artifacts
    mrz_candidates = []
    for linha in linhas:
        cleaned = linha.replace(" ", "").replace("«", "<").upper()
        if _MRZ_LINE_RE.match(cleaned) and len(cleaned) >= 30:
            mrz_candidates.append(cleaned)

    if len(mrz_candidates) < 2:
        return {
            "valido": False,
            "motivo": "MRZ não detectada — o documento não parece ser um passaporte válido",
            "mrz_linhas": [],
        }

    # Take the last 2 MRZ-like lines (MRZ is at the bottom of the page)
    mrz_line1 = mrz_candidates[-2]
    mrz_line2 = mrz_candidates[-1]

    # Check document type: first character must be 'P'
    if mrz_line1[0] != "P":
        tipo_doc = {
            "I": "Carteira de Identidade (RG/CIN)",
            "A": "Carteira de Identidade",
            "C": "Carteira de Identidade",
            "V": "Visto",
        }.get(mrz_line1[0], f"documento tipo '{mrz_line1[0]}'")
        return {
            "valido": False,
            "motivo": f"Documento identificado como {tipo_doc}, não como passaporte",
            "mrz_linhas": [mrz_line1, mrz_line2],
        }

    # Check issuing country code (positions 2-5) for Brazilian passport
    issuer = mrz_line1[2:5]
    if issuer != "BRA":
        return {
            "valido": True,
            "motivo": f"Passaporte válido (país emissor: {issuer})",
            "mrz_linhas": [mrz_line1, mrz_line2],
        }

    return {
        "valido": True,
        "motivo": "Passaporte brasileiro válido — MRZ verificada com sucesso",
        "mrz_linhas": [mrz_line1, mrz_line2],
    }


def extrair_dados_passaporte(caminho_arquivo: str) -> dict:
    """Extrai dados do passaporte via Textract sem comparar com valores esperados."""
    if not os.path.exists(caminho_arquivo):
        raise AIValidationError("Arquivo do passaporte não encontrado no servidor")

    try:
        textract = _build_aws_client("textract")
        document_bytes = _load_document_bytes(caminho_arquivo)

        analyze_id_values = _extract_analyze_id_fields(textract, document_bytes)

        response = textract.analyze_document(
            Document={"Bytes": document_bytes},
            FeatureTypes=["FORMS", "QUERIES"],
            QueriesConfig={
                "Queries": [
                    {"Text": "What is the full name on the passport?", "Alias": "FULL_NAME"},
                    {"Text": "What is the date of birth on the passport?", "Alias": "BIRTH_DATE"},
                    {"Text": "What is the date of expiry on the passport?", "Alias": "EXPIRY_DATE"},
                    {"Text": "What is the passport number?", "Alias": "PASSPORT_NUMBER"},
                ]
            },
        )
    except (ClientError, BotoCoreError) as exc:
        raise AIAnalysisError(f"Erro ao consultar Amazon Textract: {exc}") from exc

    blocks = response.get("Blocks", [])
    linhas = _extract_lines_from_blocks(blocks)

    if not linhas:
        try:
            fallback = textract.detect_document_text(Document={"Bytes": document_bytes})
            linhas = _extract_lines_from_blocks(fallback.get("Blocks", []))
        except (ClientError, BotoCoreError):
            linhas = []

    if not linhas:
        raise AIValidationError("Não foi possível extrair texto legível do passaporte")

    form_values = _extract_forms_key_values(blocks)
    query_values = _extract_query_results(blocks)
    all_values: dict[str, str] = {**form_values, **query_values, **analyze_id_values}

    if TEXTRACT_DEBUG:
        print("[TEXTRACT DEBUG] Campos extraidos (extração):")
        for key in sorted(all_values.keys()):
            print(f"  - {key}: {all_values[key]}")

    # Nome
    surname = _find_by_aliases(all_values, ("SURNAME", "APELLIDO", "SOBRENOME"))
    given_names = _find_by_aliases(all_values, ("GIVEN NAMES", "GIVEN", "NOMBRES", "NOME / GIVEN"))
    full_name_from_forms = _find_by_aliases(
        all_values,
        ("FULL_NAME", "NOME COMPLETO", "NAME", "NOM", "NOMBRE", "NOME"),
    )
    nome_extraido = None
    if surname and given_names:
        nome_extraido = f"{given_names} {surname}".strip()
    if not nome_extraido:
        nome_extraido = full_name_from_forms
    if not nome_extraido:
        nome_extraido = _extract_name_candidate(linhas)

    # Data de nascimento
    data_nascimento = _extract_date_from_values(
        all_values,
        ("BIRTH_DATE", "DATE OF BIRTH", "DOB", "NASC", "NAISS", "NACIMIENTO"),
    )
    if not data_nascimento:
        data_nascimento = _extract_date_from_lines_by_keywords(linhas, ("NASC", "BIRTH", "DOB", "NAISS"))

    # Data de validade
    data_validade = _extract_date_from_values(
        all_values,
        ("EXPIRY_DATE", "DATE OF EXPIRY", "EXP", "VALID", "VENC"),
    )
    if not data_validade:
        data_validade = _extract_date_from_lines_by_keywords(linhas, ("VAL", "EXPIR", "VENC", "VALID"))

    # Fallback por cronologia
    texto_completo = "\n".join(linhas)
    all_dates = sorted(_extract_dates(texto_completo))
    if not data_nascimento and all_dates:
        data_nascimento = all_dates[0]
    if not data_validade:
        data_validade = _extract_expiration_date(texto_completo)
    if not data_validade and all_dates:
        data_validade = all_dates[-1]

    # Número do passaporte
    numero_passaporte = _find_by_aliases(
        all_values,
        ("PASSPORT_NUMBER", "DOCUMENT NUMBER", "NUMERO", "NUMBER", "NO. DO PASSAPORTE"),
    )

    # MRZ validation
    mrz_validacao = _validar_mrz_passaporte(linhas)

    return {
        "nome_completo": nome_extraido,
        "data_nascimento": data_nascimento.isoformat() if data_nascimento else None,
        "data_expiracao_passaporte": data_validade.isoformat() if data_validade else None,
        "passaporte": numero_passaporte,
        "mrz_valido": mrz_validacao["valido"],
        "mrz_motivo": mrz_validacao["motivo"],
    }


def analisar_passaporte_textract(
    caminho_arquivo: str,
    nome_esperado: str,
    data_nascimento_esperada: date | None,
    data_validade_esperada: date | None,
) -> dict:
    if not os.path.exists(caminho_arquivo):
        raise AIValidationError("Arquivo do passaporte não encontrado no servidor")

    try:
        textract = _build_aws_client("textract")
        document_bytes = _load_document_bytes(caminho_arquivo)

        analyze_id_values = _extract_analyze_id_fields(textract, document_bytes)

        response = textract.analyze_document(
            Document={"Bytes": document_bytes},
            FeatureTypes=["FORMS", "QUERIES"],
            QueriesConfig={
                "Queries": [
                    {"Text": "What is the full name on the passport?", "Alias": "FULL_NAME"},
                    {"Text": "What is the date of birth on the passport?", "Alias": "BIRTH_DATE"},
                    {"Text": "What is the date of expiry on the passport?", "Alias": "EXPIRY_DATE"},
                ]
            },
        )
    except (ClientError, BotoCoreError) as exc:
        raise AIAnalysisError(f"Erro ao consultar Amazon Textract: {exc}") from exc

    blocks = response.get("Blocks", [])
    linhas = _extract_lines_from_blocks(blocks)

    if not linhas:
        # Fallback para OCR simples quando o retorno de Forms não contém linhas úteis.
        try:
            fallback = textract.detect_document_text(Document={"Bytes": document_bytes})
            linhas = _extract_lines_from_blocks(fallback.get("Blocks", []))
        except (ClientError, BotoCoreError):
            linhas = []

    if not linhas:
        raise AIValidationError("Não foi possível extrair texto legível do passaporte")

    form_values = _extract_forms_key_values(blocks)
    query_values = _extract_query_results(blocks)
    all_values: dict[str, str] = {**form_values, **query_values, **analyze_id_values}

    if TEXTRACT_DEBUG:
        print("[TEXTRACT DEBUG] Campos extraidos (forms/queries/analyze_id):")
        for key in sorted(all_values.keys()):
            print(f"  - {key}: {all_values[key]}")

    surname = _find_by_aliases(all_values, ("SURNAME", "APELLIDO", "SOBRENOME"))
    given_names = _find_by_aliases(all_values, ("GIVEN NAMES", "GIVEN", "NOMBRES", "NOME / GIVEN"))
    full_name_from_forms = _find_by_aliases(
        all_values,
        (
            "FULL_NAME",
            "NOME COMPLETO",
            "NAME",
            "NOM",
            "NOMBRE",
            "NOME",
        ),
    )

    texto_completo = "\n".join(linhas)
    texto_normalizado = _normalize_text(texto_completo)
    nome_normalizado = _normalize_text(nome_esperado)
    nome_extraido = None
    # Prefer surname + given names because many passports split name fields this way.
    if surname and given_names:
        nome_extraido = f"{given_names} {surname}".strip()
    if not nome_extraido:
        nome_extraido = full_name_from_forms
    if not nome_extraido:
        nome_extraido = _extract_name_candidate(linhas)
    nome_extraido_normalizado = _normalize_text(nome_extraido)
    nome_confere = bool(
        nome_normalizado
        and (nome_normalizado in texto_normalizado or (nome_extraido_normalizado and nome_normalizado == nome_extraido_normalizado))
    )

    data_nascimento_extraida = _extract_date_from_values(
        all_values,
        ("BIRTH_DATE", "DATE OF BIRTH", "DOB", "NASC", "NAISS", "NACIMIENTO"),
    )
    if not data_nascimento_extraida:
        data_nascimento_extraida = _extract_date_from_lines_by_keywords(
            linhas,
            ("NASC", "BIRTH", "DOB", "NAISS"),
        )

    data_validade_extraida = _extract_date_from_values(
        all_values,
        ("EXPIRY_DATE", "DATE OF EXPIRY", "EXP", "VALID", "VENC"),
    )
    if not data_validade_extraida:
        data_validade_extraida = _extract_date_from_lines_by_keywords(
            linhas,
            ("VAL", "EXPIR", "VENC", "VALID"),
        )

    # Fallback: when keywords are absent in OCR, infer dates by chronology.
    all_dates = sorted(_extract_dates(texto_completo))
    if not data_nascimento_extraida and all_dates:
        data_nascimento_extraida = all_dates[0]
    if not data_validade_extraida:
        data_validade_extraida = _extract_expiration_date(texto_completo)
    if not data_validade_extraida and all_dates:
        data_validade_extraida = all_dates[-1]

    nascimento_confere = bool(
        data_nascimento_extraida and data_nascimento_esperada and data_nascimento_extraida == data_nascimento_esperada
    )
    validade_confere = bool(data_validade_extraida and data_validade_esperada and data_validade_extraida == data_validade_esperada)

    aprovado = bool(nome_confere and validade_confere)

    if TEXTRACT_DEBUG:
        print("[TEXTRACT DEBUG] Resultado parser passaporte:")
        print(f"  - nome_esperado={nome_esperado}")
        print(f"  - nome_extraido={nome_extraido}")
        print(f"  - data_nascimento_esperada={data_nascimento_esperada}")
        print(f"  - data_nascimento_extraida={data_nascimento_extraida}")
        print(f"  - data_validade_esperada={data_validade_esperada}")
        print(f"  - data_validade_extraida={data_validade_extraida}")
        print(f"  - nome_confere={nome_confere} | validade_confere={validade_confere} | aprovado={aprovado}")
    if aprovado:
        mensagem = "Aprovado por IA: nome e validade do passaporte conferem com o processo"
    else:
        mensagem = (
            "Rejeitado por IA: divergências identificadas. "
            f"Nome informado: {nome_esperado or 'não informado'} | "
            f"Nome no passaporte: {nome_extraido or 'não identificado'} | "
            f"Nascimento informado: {_format_date_br(data_nascimento_esperada)} | "
            f"Nascimento no passaporte: {_format_date_br(data_nascimento_extraida)} | "
            f"Validade informada: {_format_date_br(data_validade_esperada)} | "
            f"Validade no passaporte: {_format_date_br(data_validade_extraida)}"
        )

    return {
        "aprovado": aprovado,
        "mensagem": mensagem,
        "nome_confere": nome_confere,
        "nome_extraido": nome_extraido,
        "nascimento_confere": nascimento_confere,
        "nascimento_extraido": data_nascimento_extraida.isoformat() if data_nascimento_extraida else None,
        "nascimento_esperado": data_nascimento_esperada.isoformat() if data_nascimento_esperada else None,
        "validade_confere": validade_confere,
        "validade_extraida": data_validade_extraida.isoformat() if data_validade_extraida else None,
        "validade_esperada": data_validade_esperada.isoformat() if data_validade_esperada else None,
    }


def _carregar_imagem_como_bytes(caminho: str, descricao: str) -> bytes:
    """Carrega um arquivo de imagem e retorna bytes JPEG compatíveis com Rekognition."""
    try:
        img = Image.open(caminho)
    except Exception:
        raise AIValidationError(
            f"{descricao}: formato não suportado para análise facial. "
            "Envie uma imagem JPEG ou PNG."
        )
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _detectar_rostos(rekognition, image_bytes: bytes, descricao: str) -> int:
    """Verifica quantos rostos existem na imagem usando DetectFaces."""
    try:
        resp = rekognition.detect_faces(Image={"Bytes": image_bytes}, Attributes=["DEFAULT"])
        return len(resp.get("FaceDetails", []))
    except (ClientError, BotoCoreError) as exc:
        raise AIAnalysisError(
            f"Erro ao detectar rostos na imagem de {descricao}: {exc}"
        ) from exc


def comparar_foto_com_passaporte_rekognition(caminho_foto: str, caminho_passaporte: str) -> dict:
    if not os.path.exists(caminho_foto):
        raise AIValidationError("Arquivo de foto não encontrado no servidor")
    if not os.path.exists(caminho_passaporte):
        raise AIValidationError("Arquivo de passaporte de referência não encontrado no servidor")

    foto_bytes = _carregar_imagem_como_bytes(caminho_foto, "Foto")
    passaporte_bytes = _carregar_imagem_como_bytes(caminho_passaporte, "Passaporte")

    rekognition = _build_aws_client("rekognition")

    # Pré-validar: garantir que ambas as imagens contêm rostos detectáveis
    rostos_passaporte = _detectar_rostos(rekognition, passaporte_bytes, "passaporte")
    if rostos_passaporte == 0:
        return {
            "aprovado": False,
            "mensagem": "Rejeitado por IA: nenhum rosto detectado na imagem do passaporte. Envie uma imagem mais nítida.",
            "similaridade": 0.0,
            "limiar": SIMILARIDADE_MINIMA_FOTO,
        }

    rostos_foto = _detectar_rostos(rekognition, foto_bytes, "foto")
    if rostos_foto == 0:
        return {
            "aprovado": False,
            "mensagem": "Rejeitado por IA: nenhum rosto detectado na foto enviada. Envie uma foto de rosto nítida e bem iluminada.",
            "similaridade": 0.0,
            "limiar": SIMILARIDADE_MINIMA_FOTO,
        }

    try:
        response = rekognition.compare_faces(
            SourceImage={"Bytes": passaporte_bytes},
            TargetImage={"Bytes": foto_bytes},
            SimilarityThreshold=SIMILARIDADE_MINIMA_FOTO,
        )
    except (ClientError, BotoCoreError) as exc:
        raise AIAnalysisError(f"Erro ao consultar Amazon Rekognition: {exc}") from exc

    face_matches = response.get("FaceMatches", [])
    maior_similaridade = 0.0
    if face_matches:
        maior_similaridade = max(match.get("Similarity", 0.0) for match in face_matches)

    aprovado = maior_similaridade >= SIMILARIDADE_MINIMA_FOTO
    mensagem = (
        f"Aprovado por IA: similaridade facial de {maior_similaridade:.2f}%"
        if aprovado
        else f"Rejeitado por IA: similaridade facial de {maior_similaridade:.2f}% (mínimo {SIMILARIDADE_MINIMA_FOTO:.0f}%)"
    )

    return {
        "aprovado": aprovado,
        "mensagem": mensagem,
        "similaridade": round(maior_similaridade, 2),
        "limiar": SIMILARIDADE_MINIMA_FOTO,
    }
