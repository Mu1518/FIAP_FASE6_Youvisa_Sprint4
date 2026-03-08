import psycopg2
from psycopg2.extras import RealDictCursor
from config import DATABASE_URL


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_db():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            telefone VARCHAR(20) NOT NULL,
            ativo BOOLEAN DEFAULT FALSE,
            criado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS funcionarios (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            criado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS codigos_otp (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            codigo VARCHAR(6) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            expira_em TIMESTAMP NOT NULL,
            usado BOOLEAN DEFAULT FALSE,
            criado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS processos (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER REFERENCES usuarios(id),
            tipo VARCHAR(50) NOT NULL,
            status VARCHAR(50) DEFAULT 'recebido',
            descricao TEXT,
            nome_completo VARCHAR(255) NOT NULL DEFAULT '',
            data_nascimento DATE,
            passaporte VARCHAR(50),
            data_expiracao_passaporte DATE,
            pais_destino VARCHAR(100),
            criado_em TIMESTAMP DEFAULT NOW(),
            atualizado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    # Adicionar colunas novas caso a tabela já exista
    for col, tipo in [
        ("nome_completo", "VARCHAR(255) NOT NULL DEFAULT ''"),
        ("data_nascimento", "DATE"),
        ("passaporte", "VARCHAR(50)"),
        ("data_expiracao_passaporte", "DATE"),
        ("pais_destino", "VARCHAR(100)"),
    ]:
        cur.execute(f"""
            DO $$ BEGIN
                ALTER TABLE processos ADD COLUMN {col} {tipo};
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
        """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS documentos (
            id SERIAL PRIMARY KEY,
            processo_id INTEGER REFERENCES processos(id) ON DELETE CASCADE,
            nome_original VARCHAR(255) NOT NULL,
            nome_arquivo VARCHAR(255) NOT NULL,
            tipo_arquivo VARCHAR(100),
            tipo_documento VARCHAR(50) NOT NULL DEFAULT 'passaporte',
            tamanho INTEGER,
            criado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        DO $$ BEGIN
            ALTER TABLE documentos ADD COLUMN tipo_documento VARCHAR(50) NOT NULL DEFAULT 'passaporte';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    # Colunas de revisão de documentos (status por documento)
    for col, tipo in [
        ("status", "VARCHAR(20) NOT NULL DEFAULT 'pendente_revisao'"),
        ("feedback", "TEXT"),
        ("revisado_por", "INTEGER REFERENCES funcionarios(id)"),
        ("revisado_em", "TIMESTAMP"),
    ]:
        cur.execute(f"""
            DO $$ BEGIN
                ALTER TABLE documentos ADD COLUMN {col} {tipo};
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
        """)

    # Tabela de solicitações de documento (admin solicita documentos específicos)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS solicitacoes_documento (
            id SERIAL PRIMARY KEY,
            processo_id INTEGER REFERENCES processos(id) ON DELETE CASCADE,
            tipo_documento VARCHAR(50) NOT NULL,
            descricao TEXT,
            obrigatoria BOOLEAN DEFAULT TRUE,
            status VARCHAR(20) DEFAULT 'pendente',
            documento_id INTEGER REFERENCES documentos(id) ON DELETE SET NULL,
            solicitado_por INTEGER REFERENCES funcionarios(id),
            criado_em TIMESTAMP DEFAULT NOW(),
            atualizado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transicoes_processo (
            id SERIAL PRIMARY KEY,
            processo_id INTEGER REFERENCES processos(id) ON DELETE CASCADE,
            status_anterior VARCHAR(50) NOT NULL,
            status_novo VARCHAR(50) NOT NULL,
            responsavel_id INTEGER NOT NULL,
            responsavel_tipo VARCHAR(20) NOT NULL,
            observacao TEXT,
            criado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS notificacoes (
            id SERIAL PRIMARY KEY,
            processo_id INTEGER REFERENCES processos(id) ON DELETE CASCADE,
            usuario_id INTEGER REFERENCES usuarios(id),
            tipo VARCHAR(50) NOT NULL,
            email_destino VARCHAR(255) NOT NULL,
            assunto VARCHAR(255) NOT NULL,
            status_anterior VARCHAR(50),
            status_novo VARCHAR(50),
            enviado BOOLEAN DEFAULT FALSE,
            erro TEXT,
            criado_em TIMESTAMP DEFAULT NOW()
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Banco de dados inicializado com sucesso.")
