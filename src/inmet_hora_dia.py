import pandas as pd
import os


def calcular_medias_diarias(df):
    """
    Calcula as médias diárias para cada estação.
    """
    # Seleciona apenas colunas numéricas, exceto o índice
    numeric_cols = df.select_dtypes(include=['number']).columns
    # Remove colunas que não são parâmetros meteorológicos, se necessário
    numeric_cols = [col for col in numeric_cols if col not in ['CD_ESTACAO']]
    daily_means = df.groupby(['CD_ESTACAO', 'DATA'])[
        numeric_cols].mean().reset_index()
    return daily_means


def preencher_faltantes_com_media_temporal(df, coluna):
    """
    Preenche os valores faltantes de uma coluna com a média temporal.
    """
    df['DATA'] = pd.to_datetime(df['DATA'])
    df['DIA_MES'] = df['DATA'].dt.strftime('%m-%d')
    media_temporal = df.groupby('DIA_MES')[coluna].mean()

    def preencher(row):
        if pd.isna(row[coluna]):
            return media_temporal.get(row['DIA_MES'], pd.NA)
        return row[coluna]

    return df.apply(preencher, axis=1)


if __name__ == "__main__":
    nome_arquivo = r'C:\Users\techg\Desktop\TESTESP3\inmet\bsb.CSV'

    try:
        df = pd.read_csv(nome_arquivo, sep=';', low_memory=False)
        df['DATA'] = pd.to_datetime(df['DATA'], format='%d/%m/%Y')

        # Garante que as colunas numéricas estejam no tipo correto
        colunas_para_preencher = [
            'PRECIPITACAO_TOTAL', 'PRESSAO_ATMOSFERICA', 'RADIACAO_GLOBAL',
            'TEMPERATURA_BULBO_SECO', 'TEMPERATURA_PONTO_ORVALHO',
            'UMIDADE_RELATIVA', 'RAJADA_VENTO', 'VELOCIDADE_VENTO'
        ]
        for coluna in colunas_para_preencher:
            df[coluna] = pd.to_numeric(df[coluna], errors='coerce')

        print("Dados carregados com sucesso!")

        print("\nPreenchendo valores faltantes com a média temporal...")
        for coluna in colunas_para_preencher:
            df[coluna] = preencher_faltantes_com_media_temporal(
                df.copy(), coluna)

        print("Valores faltantes preenchidos!")

        medias_diarias = calcular_medias_diarias(df.copy())

        print("\nMédias diárias calculadas:")
        print(medias_diarias)

        # Salva as médias diárias no mesmo diretório do arquivo original
        caminho_saida = os.path.join(os.path.dirname(
            nome_arquivo), 'medias_diarias.csv')
        medias_diarias.to_csv(caminho_saida, float_format="%.2f", index=False)
        print(f"\nMédias diárias salvas em '{caminho_saida}'")

    except FileNotFoundError:
        print(f"Erro: O arquivo '{nome_arquivo}' não foi encontrado.")
    except Exception as e:
        print(f"Ocorreu um erro: {e}")
