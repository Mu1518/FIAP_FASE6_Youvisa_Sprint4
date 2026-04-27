import re
import json as _json

import oracledb
from config import DATABASE_URL, DATABASE_USER, DATABASE_PASSWORD

# Fetch CLOBs as Python strings instead of LOB objects
oracledb.defaults.fetch_lobs = False

pool = None


def _init_session(conn, requested_tag):
    """Set NLS formats so Oracle parses date strings the same way PostgreSQL did."""
    cursor = conn.cursor()
    cursor.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'")
    cursor.execute("ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF6'")
    cursor.execute("ALTER SESSION SET NLS_TIMESTAMP_TZ_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF6 TZR'")


def init_pool():
    global pool
    pool = oracledb.create_pool(
        user=DATABASE_USER,
        password=DATABASE_PASSWORD,
        dsn=DATABASE_URL,
        min=2,
        max=10,
        increment=1,
        session_callback=_init_session,
    )
    print("Pool de conexoes Oracle criado com sucesso.")


# ---------------------------------------------------------------------------
# DictCursor — auto-translates PostgreSQL SQL dialect to Oracle
# ---------------------------------------------------------------------------

_PH_RE = re.compile(r'%s')
_LIMIT_RE = re.compile(r'\bLIMIT\s+(\d+)\b', re.IGNORECASE)
_RETURNING_RE = re.compile(r'\bRETURNING\s+(.+?)\s*$', re.IGNORECASE | re.DOTALL)
_DML_TABLE_RE = re.compile(r'\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)', re.IGNORECASE)
_TRUE_RE = re.compile(r'\bTRUE\b', re.IGNORECASE)
_FALSE_RE = re.compile(r'\bFALSE\b', re.IGNORECASE)
_IS_DISTINCT_RE = re.compile(
    r'\((\w+(?:\.\w+)?)\s+IS\s+DISTINCT\s+FROM\s+(%s|:\d+)\)',
    re.IGNORECASE,
)


def _translate_sql(sql, params):
    """Translate PostgreSQL-flavoured SQL to Oracle dialect.

    Returns (oracle_sql, oracle_params_list).
    """
    if isinstance(params, tuple):
        params = list(params)
    elif params is None:
        params = []
    else:
        params = list(params)

    # Convert Python booleans in params to 0/1
    params = [1 if v is True else (0 if v is False else v) for v in params]

    # Replace %s positional placeholders with :1, :2, …
    counter = [0]
    def _replace_ph(_match):
        counter[0] += 1
        return f':{counter[0]}'
    sql = _PH_RE.sub(_replace_ph, sql)

    # NOW() → SYSTIMESTAMP
    sql = sql.replace('NOW()', 'SYSTIMESTAMP')
    sql = sql.replace('now()', 'SYSTIMESTAMP')

    # Boolean literals
    sql = _TRUE_RE.sub('1', sql)
    sql = _FALSE_RE.sub('0', sql)

    # Remove ::jsonb casts
    sql = sql.replace('::jsonb', '')

    # LIMIT N → FETCH FIRST N ROWS ONLY
    sql = _LIMIT_RE.sub(r'FETCH FIRST \1 ROWS ONLY', sql)

    # IS DISTINCT FROM → Oracle NULL-safe comparison
    # (col IS DISTINCT FROM :N) → (col <> :N OR (col IS NULL AND :N IS NOT NULL) OR (col IS NOT NULL AND :N IS NULL))
    def _replace_distinct(m):
        col = m.group(1)
        param = m.group(2)
        return f'({col} IS NULL OR {col} <> {param})'
    sql = _IS_DISTINCT_RE.sub(_replace_distinct, sql)

    return sql, params


def _maybe_parse_json(value):
    """Try to parse string values that look like JSON arrays or objects."""
    if isinstance(value, str) and value and value[0] in ('{', '['):
        try:
            return _json.loads(value)
        except (ValueError, _json.JSONDecodeError):
            pass
    return value


def _row_to_dict(description, row):
    """Convert a raw Oracle row + cursor.description into a dict with lowercase keys."""
    columns = [col[0].lower() for col in description]
    d = dict(zip(columns, row))
    # Auto-parse JSON strings from CLOB columns
    return {k: _maybe_parse_json(v) for k, v in d.items()}


class DictCursor:
    """Wraps an oracledb cursor to provide psycopg2-RealDictCursor-like behaviour
    with automatic PostgreSQL → Oracle SQL translation."""

    def __init__(self, cursor):
        self._cursor = cursor
        self._returning_result = None

    # -- Core execute --------------------------------------------------------

    def execute(self, sql, params=None):
        sql, params = _translate_sql(sql, params)

        # Detect RETURNING clause
        ret_match = _RETURNING_RE.search(sql)
        if ret_match:
            self._execute_returning(sql, params, ret_match)
            return

        self._returning_result = None
        if params:
            self._cursor.execute(sql, params)
        else:
            self._cursor.execute(sql)

    # -- RETURNING handler ---------------------------------------------------

    def _execute_returning(self, sql, params, ret_match):
        cols_str = ret_match.group(1).strip()
        sql_no_ret = sql[:ret_match.start()].strip()

        is_delete = sql_no_ret.lstrip().upper().startswith('DELETE')
        table_match = _DML_TABLE_RE.search(sql_no_ret)
        table_name = table_match.group(1) if table_match else None

        # Create output bind variable for the id column
        ret_id_var = self._cursor.var(int)
        next_pos = len(params) + 1
        sql_with_ret = f'{sql_no_ret} RETURNING id INTO :{next_pos}'
        all_params = params + [ret_id_var]

        self._cursor.execute(sql_with_ret, all_params)

        ret_val = ret_id_var.getvalue()
        if not ret_val or ret_val[0] is None:
            self._returning_result = None
            return

        row_id = int(ret_val[0])

        if is_delete:
            # Row is gone after DELETE; build minimal dict
            self._returning_result = {"id": row_id}
            return

        # For INSERT / UPDATE: SELECT the requested columns
        if cols_str.strip() == '*':
            select_sql = f'SELECT * FROM {table_name} WHERE id = :1'
        else:
            select_sql = f'SELECT {cols_str} FROM {table_name} WHERE id = :1'

        self._cursor.execute(select_sql, [row_id])
        row = self._cursor.fetchone()
        if row:
            self._returning_result = _row_to_dict(self._cursor.description, row)
        else:
            self._returning_result = None

    # -- Fetch ---------------------------------------------------------------

    def fetchone(self):
        if self._returning_result is not None:
            result = self._returning_result
            self._returning_result = None
            return result

        row = self._cursor.fetchone()
        if row is None:
            return None
        return _row_to_dict(self._cursor.description, row)

    def fetchall(self):
        rows = self._cursor.fetchall()
        if not rows:
            return []
        desc = self._cursor.description
        return [_row_to_dict(desc, row) for row in rows]

    # -- Misc ----------------------------------------------------------------

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description

    def var(self, *args, **kwargs):
        return self._cursor.var(*args, **kwargs)

    def close(self):
        self._cursor.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# ---------------------------------------------------------------------------
# DictConnection
# ---------------------------------------------------------------------------

class DictConnection:
    """Wraps an oracledb connection to return DictCursor instances."""

    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return DictCursor(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_connection():
    if pool is None:
        raise RuntimeError("Pool nao inicializado. Chame init_pool() primeiro.")
    return DictConnection(pool.acquire())


# ---------------------------------------------------------------------------
# Helpers for init_db
# ---------------------------------------------------------------------------

def _table_exists(cur, table_name):
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM user_tables WHERE table_name = :1",
        [table_name.upper()],
    )
    return cur.fetchone()["cnt"] > 0


def _column_exists(cur, table_name, column_name):
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM user_tab_columns WHERE table_name = :1 AND column_name = :2",
        [table_name.upper(), column_name.upper()],
    )
    return cur.fetchone()["cnt"] > 0


def _add_column_if_not_exists(cur, table_name, column_name, column_def):
    if not _column_exists(cur, table_name, column_name):
        cur.execute(f"ALTER TABLE {table_name} ADD ({column_name} {column_def})")


# ---------------------------------------------------------------------------
# Schema initialisation (Oracle DDL)
# ---------------------------------------------------------------------------

def init_db():
    if pool is None:
        init_pool()

    conn = get_connection()
    cur = conn.cursor()

    # --- usuarios ---
    if not _table_exists(cur, "usuarios"):
        cur.execute("""
            CREATE TABLE usuarios (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nome VARCHAR2(255) NOT NULL,
                email VARCHAR2(255) NOT NULL UNIQUE,
                telefone VARCHAR2(20) NOT NULL,
                ativo NUMBER(1) DEFAULT 0,
                idioma VARCHAR2(10) DEFAULT 'pt-BR' NOT NULL,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    _add_column_if_not_exists(cur, "usuarios", "idioma", "VARCHAR2(10) DEFAULT 'pt-BR' NOT NULL")

    # --- funcionarios ---
    if not _table_exists(cur, "funcionarios"):
        cur.execute("""
            CREATE TABLE funcionarios (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nome VARCHAR2(255) NOT NULL,
                email VARCHAR2(255) NOT NULL UNIQUE,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # Seed default employee
    cur.execute("""
        BEGIN
            INSERT INTO funcionarios (nome, email) VALUES ('Jonatas', 'jonatasgomes@gmail.com');
            INSERT INTO funcionarios (nome, email) VALUES ('Murilo', 'murilocnasser@gmail.com');
            INSERT INTO funcionarios (nome, email) VALUES ('Pedro', 'pesdesousa@outlook.com.br');
            INSERT INTO funcionarios (nome, email) VALUES ('Amanda', 'amanda.oliveira.fragnan@gmail.com');
            INSERT INTO funcionarios (nome, email) VALUES ('Iolanda', 'techgirlsdivetoo@gmail.com');
        EXCEPTION WHEN DUP_VAL_ON_INDEX THEN NULL;
        END;
    """)

    # --- codigos_otp ---
    if not _table_exists(cur, "codigos_otp"):
        cur.execute("""
            CREATE TABLE codigos_otp (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                email VARCHAR2(255) NOT NULL,
                codigo VARCHAR2(6) NOT NULL,
                tipo VARCHAR2(20) NOT NULL,
                expira_em TIMESTAMP NOT NULL,
                usado NUMBER(1) DEFAULT 0,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- processos ---
    if not _table_exists(cur, "processos"):
        cur.execute("""
            CREATE TABLE processos (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                usuario_id NUMBER REFERENCES usuarios(id),
                tipo VARCHAR2(50) NOT NULL,
                status VARCHAR2(50) DEFAULT 'recebido',
                descricao CLOB,
                nome_completo VARCHAR2(255) DEFAULT '',
                data_nascimento DATE,
                passaporte VARCHAR2(50),
                data_expiracao_passaporte DATE,
                pais_destino VARCHAR2(100),
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    for col, tipo in [
        ("nome_completo", "VARCHAR2(255) DEFAULT ''"),
        ("data_nascimento", "DATE"),
        ("passaporte", "VARCHAR2(50)"),
        ("data_expiracao_passaporte", "DATE"),
        ("pais_destino", "VARCHAR2(100)"),
    ]:
        _add_column_if_not_exists(cur, "processos", col, tipo)

    # --- documentos ---
    if not _table_exists(cur, "documentos"):
        cur.execute("""
            CREATE TABLE documentos (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                processo_id NUMBER REFERENCES processos(id) ON DELETE CASCADE,
                nome_original VARCHAR2(255) NOT NULL,
                nome_arquivo VARCHAR2(255) NOT NULL,
                tipo_arquivo VARCHAR2(100),
                tipo_documento VARCHAR2(50) DEFAULT 'passaporte' NOT NULL,
                tamanho NUMBER(10),
                status VARCHAR2(20) DEFAULT 'pendente_revisao' NOT NULL,
                feedback CLOB,
                revisado_por NUMBER REFERENCES funcionarios(id),
                revisado_em TIMESTAMP,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    _add_column_if_not_exists(cur, "documentos", "tipo_documento", "VARCHAR2(50) DEFAULT 'passaporte' NOT NULL")
    for col, tipo in [
        ("status", "VARCHAR2(20) DEFAULT 'pendente_revisao' NOT NULL"),
        ("feedback", "CLOB"),
        ("revisado_por", "NUMBER REFERENCES funcionarios(id)"),
        ("revisado_em", "TIMESTAMP"),
    ]:
        _add_column_if_not_exists(cur, "documentos", col, tipo)

    # --- solicitacoes_documento ---
    if not _table_exists(cur, "solicitacoes_documento"):
        cur.execute("""
            CREATE TABLE solicitacoes_documento (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                processo_id NUMBER REFERENCES processos(id) ON DELETE CASCADE,
                tipo_documento VARCHAR2(50) NOT NULL,
                descricao CLOB,
                obrigatoria NUMBER(1) DEFAULT 1,
                status VARCHAR2(20) DEFAULT 'pendente',
                documento_id NUMBER REFERENCES documentos(id) ON DELETE SET NULL,
                solicitado_por NUMBER REFERENCES funcionarios(id),
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- transicoes_processo ---
    if not _table_exists(cur, "transicoes_processo"):
        cur.execute("""
            CREATE TABLE transicoes_processo (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                processo_id NUMBER REFERENCES processos(id) ON DELETE CASCADE,
                status_anterior VARCHAR2(50) NOT NULL,
                status_novo VARCHAR2(50) NOT NULL,
                responsavel_id NUMBER NOT NULL,
                responsavel_tipo VARCHAR2(20) NOT NULL,
                observacao CLOB,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- notificacoes ---
    if not _table_exists(cur, "notificacoes"):
        cur.execute("""
            CREATE TABLE notificacoes (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                processo_id NUMBER REFERENCES processos(id) ON DELETE CASCADE,
                usuario_id NUMBER REFERENCES usuarios(id),
                tipo VARCHAR2(50) NOT NULL,
                email_destino VARCHAR2(255) NOT NULL,
                assunto VARCHAR2(255) NOT NULL,
                status_anterior VARCHAR2(50),
                status_novo VARCHAR2(50),
                enviado NUMBER(1) DEFAULT 0,
                erro CLOB,
                telegram_enviado NUMBER(1) DEFAULT 0,
                telegram_erro CLOB,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    for col, tipo in [
        ("telegram_enviado", "NUMBER(1) DEFAULT 0"),
        ("telegram_erro", "CLOB"),
    ]:
        _add_column_if_not_exists(cur, "notificacoes", col, tipo)

    # --- telegram_vinculos ---
    if not _table_exists(cur, "telegram_vinculos"):
        cur.execute("""
            CREATE TABLE telegram_vinculos (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                usuario_id NUMBER REFERENCES usuarios(id) ON DELETE CASCADE UNIQUE,
                telegram_chat_id NUMBER(19) NOT NULL UNIQUE,
                telegram_username VARCHAR2(255),
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- telegram_codigos_vinculacao ---
    if not _table_exists(cur, "telegram_codigos_vinculacao"):
        cur.execute("""
            CREATE TABLE telegram_codigos_vinculacao (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                usuario_id NUMBER REFERENCES usuarios(id) ON DELETE CASCADE,
                codigo VARCHAR2(64) NOT NULL UNIQUE,
                expira_em TIMESTAMP NOT NULL,
                usado NUMBER(1) DEFAULT 0,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- telegram_conversas ---
    if not _table_exists(cur, "telegram_conversas"):
        cur.execute("""
            CREATE TABLE telegram_conversas (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                telegram_chat_id NUMBER(19) NOT NULL UNIQUE,
                estado VARCHAR2(50) DEFAULT 'idle' NOT NULL,
                dados CLOB DEFAULT '{}' CHECK (dados IS JSON),
                atualizado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- handoff_solicitacoes ---
    if not _table_exists(cur, "handoff_solicitacoes"):
        cur.execute("""
            CREATE TABLE handoff_solicitacoes (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                usuario_id NUMBER REFERENCES usuarios(id),
                telegram_chat_id NUMBER(19),
                canal VARCHAR2(20) DEFAULT 'telegram' NOT NULL,
                motivo CLOB,
                status VARCHAR2(20) DEFAULT 'pendente',
                atendido_por NUMBER REFERENCES funcionarios(id),
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- handoff_mensagens ---
    if not _table_exists(cur, "handoff_mensagens"):
        cur.execute("""
            CREATE TABLE handoff_mensagens (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                handoff_id NUMBER REFERENCES handoff_solicitacoes(id) ON DELETE CASCADE,
                remetente_tipo VARCHAR2(20) NOT NULL,
                remetente_id NUMBER,
                conteudo CLOB NOT NULL,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    # --- requisitos_visto ---
    if not _table_exists(cur, "requisitos_visto"):
        cur.execute("""
            CREATE TABLE requisitos_visto (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                tipo_visto VARCHAR2(50) NOT NULL,
                pais_destino VARCHAR2(100) NOT NULL,
                documentos_obrigatorios CLOB DEFAULT '[]' CHECK (documentos_obrigatorios IS JSON),
                validade_minima_passaporte_meses NUMBER(10) DEFAULT 6 NOT NULL,
                regras_adicionais CLOB DEFAULT '{}' CHECK (regras_adicionais IS JSON),
                ativo NUMBER(1) DEFAULT 1,
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
                atualizado_em TIMESTAMP DEFAULT SYSTIMESTAMP,
                UNIQUE(tipo_visto, pais_destino)
            )
        """)

    # --- analises_caso ---
    if not _table_exists(cur, "analises_caso"):
        cur.execute("""
            CREATE TABLE analises_caso (
                id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                processo_id NUMBER REFERENCES processos(id) ON DELETE CASCADE,
                pontuacao NUMBER(10) DEFAULT 0 NOT NULL,
                itens CLOB DEFAULT '[]' CHECK (itens IS JSON),
                resumo_ia CLOB,
                documentos_faltantes CLOB DEFAULT '[]' CHECK (documentos_faltantes IS JSON),
                alertas CLOB DEFAULT '[]' CHECK (alertas IS JSON),
                analisado_por NUMBER REFERENCES funcionarios(id),
                criado_em TIMESTAMP DEFAULT SYSTIMESTAMP
            )
        """)

    conn.commit()
    cur.close()
    conn.close()
    print("Banco de dados Oracle inicializado com sucesso.")
