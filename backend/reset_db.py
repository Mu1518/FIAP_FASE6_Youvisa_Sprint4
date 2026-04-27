"""
Reseta o banco de dados completamente.
Remove todas as tabelas e limpa a pasta de uploads.
Ao reiniciar o backend (uvicorn), init_db() recria tudo automaticamente.
"""

import os
import shutil
from database import init_pool, get_connection

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")


def reset():
    init_pool()
    conn = get_connection()
    cur = conn.cursor()

    # Buscar todas as tabelas do usuario
    cur.execute("SELECT table_name FROM user_tables")
    tables = [row["table_name"] for row in cur.fetchall()]

    # Drop com CASCADE CONSTRAINTS para ignorar dependencias
    for table_name in tables:
        cur.execute(f"DROP TABLE {table_name} CASCADE CONSTRAINTS PURGE")

    conn.commit()
    cur.close()
    conn.close()
    print(f"Todas as tabelas foram removidas ({len(tables)} tabelas).")

    # Limpar uploads
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, f)
            if os.path.isfile(filepath):
                os.remove(filepath)
        print("Pasta uploads limpa.")

    print("Reinicie o backend para recriar as tabelas.")


if __name__ == "__main__":
    confirm = input("Isso vai APAGAR TODOS os dados. Continuar? (s/N): ")
    if confirm.strip().lower() == "s":
        reset()
    else:
        print("Cancelado.")
