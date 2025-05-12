# FIAP - Faculdade de Informática e Administração Paulista

<p align="center">
<a href= "https://www.fiap.com.br/"><img src="assets/logo-fiap.png" alt="FIAP - Faculdade de Informática e Admnistração Paulista" border="0" width=40% height=40%></a>
</p>

<br>

# PROJETO - :artificial_satellite: SPRINT 3 INGREDION  

<img src="https://github.com/Ioiofmanzali/FIAP_FASE_5_SPRINT_2/blob/main/assets/talhoes.jpeg" width="1980">

## Grupo 22

## 👨‍🎓 Integrantes: 
- <a href="https://www.linkedin.com/in/jonatasgomes">Jônatas Gomes Alves</a>
- <a href="https://www.linkedin.com/in/iolanda-helena-fabbrini-manzali-de-oliveira-14ab8ab0">Iolanda Helena Fabbrini Manzali de Oliveira</a>
- <a href="https://www.linkedin.com/company/inova-fusca">Murilo Carone Nasser</a> 
- <a href="https://www.linkedin.com/in/pedro-eduardo-soares-de-sousa-439552309">Pedro Eduardo Soares de Sousa</a>
- <a href= "https://www.linkedin.com/in/amanda-fragnan-b61537255">Amanda Fragnan<a>

## 👩‍🏫 Professores:
### Tutor(a) 
- <a href="https://www.linkedin.com/in/leonardoorabona">Leonardo Ruiz Orabona</a>
### Coordenador(a)
- <a href="https://www.linkedin.com/company/inova-fusca">Andre Godoi Chaviato</a>

## :page_with_curl:DOCUMENTAÇÃO

Documentação Técnica do Projeto "CHALLENGE INGREDION - Sprint 2"

![Versão 2.0.0](https://img.shields.io/badge/Vers%C3%A3o%202.0.0-gray?style=flat) 

Autores: Jonatas Gomes, Iolanda Manzali, Murilo Nasser, Pedro Sousa, Amanda Fragnan

## 🔍 SOBRE O PROJETO
RESSECREVER ESSE TRECHO - COLOCAR QUE É PRA SPRINT 3 E QUE REPRESENTA UMA VERSAO MELHORADA EM RELCAO A ANTERIOR

Este projeto, baseado na segunda fase do Challenge Ingredion do Curso de Inteligência Artificial da FiAP (1TIAO), tem como foco o desenvolvimento de um modelo de Inteligência Artificial para cálculo de previsão da produtividade agrícola, utilizando NDVI (Índice de Vegetação Normalizada), dados climáticos, de produtividade e custo.

Os datasets utilizados no programa foram previamente tratados e limpos antes de serem carregados via APEX para a nuvem Oracle. Isso ocorreu pela natureza diversa das formatações e pela necessidade de padronização dos dados para garantir a integridade e a precisão das análises. 

Os valores faltantes foram tratados com a média dos dados disponíveis, e os dados foram convertidos para o formato adequado para análise.
            
O projeto foi desenvolvido em Python, utilizando as bibliotecas, Streamlit, Pandas, NumPy, Scikit-learn, Plotly, dentre outras. 

** obs: todo o código desse projeto foi escrito utilizando a IDE (VSCode).

### 🌎 MELHORIAS IMPLEMENTADAS EM RELAÇÃO À VERSÃO 0.1.0

ESCREVER QDO FINALIZAR

### ❗ PRÉ-REQUISITOS 

* Ambiente de desenvolvimento compatível com Python,  como VSCode ou PyCharm.

* Versão do Python superior a 3.9 instalado no seu sistema operacional (Windows, macOS ou Linux). Recomendamos a versão mais recente estável.

* Streamlit instalado (via pip)

* Versão do Oracle SQL developer superior a 12c

* Internet para download das bibliotecas e dependências

Maiores informações sobre a instalação e uso dessas linguagens de Programação pode ser obtida nos sites oficiais:

1. Python: https://www.python.org/

2. Streamlit: https://docs.streamlit.io/get-started

3. Oracle: https://www.oracle.com.br

## 🛠️ TECNOLOGIAS UTILIZADAS

![Streamlit](https://img.shields.io/badge/Streamlit-%23FE4B4B.svg?style=for-the-badge&logo=streamlit&logoColor=white) &nbsp; ![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54) &nbsp; ![Oracle](https://img.shields.io/badge/Oracle-F80000?style=for-the-badge&logo=Oracle&logoColor=white)

### 1. ORACLE

* Esse projeto utiliza uma API RESTful da Oracle, hospedada na Oracle Cloud, como fonte primária de dados.
  
* A API Oracle foi configurada para permitir tratamento de paginação e erros, garantindo que os dados necessários para as funcionalidades do projeto sejam carregados de maneira confiável.

* Os dados podem ser carregados utilizando-se arquivos .csv ou .txt, via APEX ORACLE

### Mecanismo de Consumo da API

* Definição de Endpoints a partir de uma url_base constante

* Requisição HTTP GET é enviada para o endpoint definido utilizando requests.get com resposta armazenada no formato json

* Tratamento da Resposta: se a requisição for bem-sucedida, a resposta é convertida para JSON utilizando response.json(). Os dados relevantes são extraídos do campo "items" da resposta JSON e adicionados a uma lista chamada all_items.

### Paginação, Tratamento de Erros e Dados Ausentes

* o código verifica se a resposta JSON contém a chave "hasMore" e, caso seja True, tenta encontrar o link para a próxima página na seção "links" com a relação "next". Se um link "next" for encontrado, o endpoint é atualizado com este novo link e o processo de requisição é repetido até que "hasMore" seja False ou não haja um link "next" disponível.

* o código inclui tratamento de exceções para lidar com possíveis erros durante a requisição, na decodificação ou na ausência de chaves esperadas no JSON. Em caso de erro, uma mensagem é exibida no Streamlit e um DataFrame vazio é retornado.

* Após a tentativa de carregamento, o código verifica se all_items está vazio e exibe um aviso caso nenhum dado tenha sido retornado para o tipo solicitado.

* Retorno dos Dados: os dados coletados em all_items são convertidos para um DataFrame do pandas
 
### Funções de Carregamento Específicas:

* o código também define funções específicas para carregar cada tipo de dado como:
   - carregar_dados_produtividade()
   - carregar_dados_meteorologicos()
   - carregar_dados_custos()
   - carregar_dados_ndvi()
   
* estas funções chamam a função genérica 'carregar_dados_oracle()' com o tipo de dado correspondente e utilizam o decorador '@st.cache_data' do Streamlit para armazenar em cache os resultados, evitando chamadas desnecessárias à API em cada interação do usuário.
  
* a função 'carregar_dados_ndvi()' também realiza uma conversão da coluna 'data' para o tipo datetime do pandas.

### 2. PYTHON

* Atua como a linguagem principal para definir a arquitetura da aplicação web, organizando o conteúdo em múltiplas páginas acessíveis através de botões de navegação no menu principal.

** maiores detalhes na seção Arquitetura do Programa

### 3. STREAMLIT

* Simplifica o desenvolvimento da UI, permitindo que o código Python renderize de forma dinâmica os componentes interativos, visualize os resultados da análise (incluindo as previsões baseadas no NDVI) e facilite a interação do usuário com as funcionalidades do programa de forma mais amigável.

A interface do usuário é organizada em diferentes páginas, acessíveis através de botões no menu principal:

![pagina_inicial](https://github.com/Ioiofmanzali/FIAP_FASE_5_SPRINT_2/blob/main/assets/safrapro1.JPG)

* Sobre o Projeto: Fornece informações contextuais sobre o projeto, o time de desenvolvimento e os planos futuros.

* Links Importantes: Contém os links relevantes do projeto 

* Análise Exploratória: Permite visualizar os dados carregados da API Oracle, realizar uma análise básica de limpeza e visualizar séries históricas através de gráficos interativos. Também oferece a opção de baixar os dados em formato CSV.

* Treinamento de Modelos: Permite ao usuário selecionar e treinar diferentes modelos de regressão supervisionada utilizando os dados de produtividade. Exibe os resultados do treinamento e salva os modelos treinados.

* Previsão de Produtividade: Permite ao usuário inserir parâmetros (localidade, cultura, ano e mês de plantio, área plantada) e obter uma previsão da produtividade utilizando o melhor modelo treinado.

A interface utiliza componentes do Streamlit como st.markdown, st.subheader, st.write, st.dataframe, st.plotly_chart, st.download_button, st.selectbox, st.multiselect, st.number_input, st.button, st.info, st.success, st.warning, st.error, st.expander, st.balloons e st.feedback para criar uma experiência mais  interativa para o usuário.

 ### Video Demonstrativo da inteface Streamlit
 
 [LINK DO VIDEO DEMONSTRATIVO](https://youtu.be/joQEFZE4JyI)

## ➡️ ARQUITETURA DO PROGRAMA

O sistema é construído em Python e utiliza diversas bibliotecas para diferentes funcionalidades:

* Streamlit: Para a criação da interface de usuário interativa.
* Pandas: Para manipulação e análise de dados tabulares.
* NumPy: Para operações numéricas.
* Scikit-learn (sklearn): Para implementação de modelos de machine learning (Regressão Linear, SVR, Random Forest, Gradient Boosting), divisão de dados, otimização de hiperparâmetros (GridSearchCV) e métricas de avaliação (mean_squared_error).
* Pickle: Para serialização e desserialização de modelos de machine learning treinados.
* OS: Para interação com o sistema operacional (criação de diretórios, verificação de arquivos).
* Requests: Para realizar requisições HTTP para obter dados de uma API Oracle.
* Datetime: Para manipulação de datas e horas.
* Matplotlib e Plotly: Para criação de visualizações de dados.
* Locale: Para formatação de números e datas de acordo com a localidade (português do Brasil).
* IO (BytesIO): Para trabalhar com dados binários em memória.

Resumo geral da arquitetura do programa:

* Interface de Usuário (Streamlit): O usuário interage com a aplicação através de uma interface web, navegando por diferentes páginas (Sobre o Projeto, Links, Análise Exploratória, Treinamento de Modelos, Previsão de Produtividade).

* Carregamento de Dados (API Oracle): A aplicação realiza requisições HTTP GET para uma API Oracle, buscando dados de diferentes tipos: NDVI, produtividade, meteorológicos e custos. Uma função de caching (@st.cache_data) é utilizada para evitar chamadas repetidas à API.

* Análise Exploratória: Permite visualizar informações básicas sobre os dados carregados, como número de linhas, colunas, valores ausentes, duplicados e exibir séries históricas através de gráficos. Também oferece a opção de baixar os dados em formato CSV.

* Treinamento de Modelos: O usuário pode selecionar diferentes modelos de regressão supervisionada (Regressão Linear, SVR, Random Forest, Gradient Boosting) para serem treinados com os dados de produtividade. A biblioteca GridSearchCV é utilizada para encontrar os melhores hiperparâmetros para cada modelo através de validação cruzada. Os modelos treinados e seus respectivos resultados são salvos em arquivos .pkl no diretório modelos_treinados. O melhor modelo treinado (com menor Root Mean Squared Error - RMSE) também é identificado e salvo.

* Previsão de Produtividade: Permite ao usuário inserir informações sobre a localidade, cultura, ano e mês de plantio, e área plantada. Utiliza o melhor modelo treinado para prever a produtividade para as condições especificadas.

* Persistência de Modelos: Os modelos treinados são salvos localmente utilizando a biblioteca pickle, permitindo que sejam reutilizados sem a necessidade de retreinamento a cada execução da aplicação.
  
### ➡️ COMPONENTES E FUNCIONALIDADES

* Importação de Bibliotecas e Módulos: 
A seção inicial do código importa todas as bibliotecas e módulos necessários para o funcionamento da aplicação.

* Configuração da Página: 
Define o título da página web exibida no navegador e utiliza st.markdown para adicionar títulos e subtítulos estilizados à interface do usuário.

* Constantes
Define constantes importantes como a url_base da API Oracle e o CONTENT_TYPE_JSON para os headers das requisições HTTP. Também configura a localidade para português do Brasil.

* Decorador @st.cache_data
Este decorador do Streamlit permite que os resultados dessas funções sejam cacheados, evitando que a API seja chamada novamente a cada vez que a aplicação é executada ou quando ocorre uma interação que causa um rerun do Streamlit.

* Função carregar_dados_oracle(tipo)
Função é responsável por realizar as requisições para a API Oracle para carregar diferentes tipos de dados (ndvi, produtividade, meteorologicos, custos). Ela constrói o endpoint da API com base no tipo solicitado e utiliza a biblioteca requests para fazer a requisição GET. A função lida com paginação (caso a API retorne um link "next"), erros de requisição, erros de decodificação JSON e ausência de dados. Os dados são retornados como um DataFrame do Pandas.

* Funções Específicas de Carregamento (carregar_dados_produtividade, carregar_dados_meteorologicos, carregar_dados_custos, carregar_dados_ndvi)
Wrappers simples para a função carregar_dados_oracle, cada uma chamando-a com o tipo de dado específico. A função carregar_dados_ndvi também realiza a conversão da coluna 'data' para o tipo datetime do Pandas. Elas também utilizam o decorador @st.cache_data.

* Função analise_exploratoria()
Esta função carrega todos os datasets utilizando as funções de carregamento e realiza uma análise exploratória básica. Ela verifica a presença de dados, exibe informações sobre limpeza dos dados (número de linhas, colunas, valores ausentes e duplicados), exibe os DataFrames completos e plota gráficos de séries históricas para cada tipo de dado utilizando a biblioteca Plotly. Ao final, oferece botões para download dos dados em formato CSV.

* Funções de Formatação (formata_valores, formata_valores_posfixo)
Estas funções auxiliam na formatação de valores numéricos para exibição na interface do usuário, adicionando prefixos (como "R$ ") ou posfixos (como "ha" ou "kg/ha") e ajustando a escala (milhares, milhões) para melhor legibilidade.

* Função exibir_pagina_sobre()
Exibe informações sobre o projeto, o time de desenvolvimento e os próximos passos, utilizando st.subheader e st.write. Também inclui um componente de feedback utilizando st.feedback.

* Função exibir_links_importantes()
Exibe links relevantes, como o repositório do GitHub do projeto e o link para um vídeo de apresentação.

* Função treinar_modelos_supervisionados(X, y, modelos_selecionados)
Esta função recebe uma matriz de features (X), um vetor target (y) e uma lista de modelos a serem treinados. Ela divide os dados em conjuntos de treinamento e teste, define um dicionário contendo os modelos de regressão do Scikit-learn e seus respectivos grids de hiperparâmetros para otimização com GridSearchCV. Para cada modelo selecionado, realiza o treinamento e a otimização dos hiperparâmetros, faz as predições no conjunto de teste e calcula o RMSE (Root Mean Squared Error). Retorna um dicionário contendo os resultados de cada modelo (score, melhor modelo treinado e melhores parâmetros).

* Função exibir_pagina_treinamento()
Cria a interface para a página de treinamento de modelos. Permite ao usuário selecionar os modelos de regressão que deseja treinar através de um st.multiselect. Ao clicar no botão "Iniciar Treinamento", a função carrega os dados de produtividade, prepara os dados para treinamento (removendo colunas não numéricas e a coluna target, e realizando codificação one-hot para variáveis categóricas com pd.get_dummies), chama a função treinar_modelos_supervisionados e salva os modelos treinados (todos e o melhor) em arquivos .pkl no diretório modelos_treinados. Exibe os resultados do treinamento, incluindo o melhor modelo e seus detalhes.

* Função exibir_pagina_produtividade()
Cria a interface para a página de previsão de produtividade. Permite ao usuário selecionar a localidade e a cultura a partir dos dados carregados, bem como o ano e mês de plantio e a área plantada. Ao clicar no botão "Prever Produtividade" ou "Calcular", a função carrega o melhor modelo treinado, prepara os dados de entrada do usuário em um DataFrame, realiza a codificação one-hot, garante que as features de entrada correspondam às features esperadas pelo modelo, realiza a predição e exibe os resultados, incluindo a produtividade prevista por hectare e a produção total estimada.

* Função main()
É a função principal que configura a aplicação Streamlit. Ela cria um menu horizontal de botões para navegar entre as diferentes páginas da aplicação (Sobre o Projeto, Links Importantes, Análise Exploratória, Treinamento de Modelos, Previsão de Produtividade). Utiliza st.session_state para controlar qual página está ativa e chama a função correspondente para exibir o conteúdo da página selecionada.

* Bloco if __name__ == "__main__":
Este bloco garante que a função main() seja executada apenas quando o script Python é executado diretamente (e não quando é importado como um módulo). Ele também inicializa st.session_state.pagina_ativa caso não esteja definido.

### ➡️ PERSISTÊNCIA E CACHING

* Caching de Dados

A utilização do decorador @st.cache_data nas funções de carregamento de dados da API Oracle melhora a performance da aplicação, evitando requisições desnecessárias à API. Os dados são cacheados na memória e reutilizados em execuções subsequentes ou reruns do Streamlit, a menos que haja uma mudança nos parâmetros da função cacheada.

* Persistência de Modelos

Os modelos de machine learning treinados são salvos em arquivos .pkl (formato de serialização do Python) no diretório modelos_treinados. Isso permite que os modelos sejam carregados posteriormente (na página de previsão de produtividade) sem a necessidade de serem retreinados a cada vez que a aplicação é iniciada. O melhor modelo treinado também é salvo em um arquivo separado (melhor_modelo.pkl), contendo o nome do modelo, o objeto do modelo treinado, os melhores hiperparâmetros encontrados e o score obtido.

## ➡️ VARIÁVEIS E JUSTIFICATIVA DE USO

* NDVI (Índice de Vegetação Normalizada) 

** extraídos do site SATVEG-EMBRAPA

* Dados de Produtividade

** Serie histórica de área plantada, área colhida e rendimento médio da cultura do milho no municipio de Sorriso entre os anos de 2015 e 2025. Para o ano de 2025 os dados foram atualizados até o dia 10 de fevereiro.

* Dados Meteorológicos

** Informações climáticas como precipitação, pressão atmosférica, radiação solar global, temperatura do bulbo seco, temperatura do orvalho, umidade relativa e velocidade do vento.

* Dados de Custos (baseados em balanços anuais) 

** Série histórica sobre custos de produção agrícola baseados em balanços patrimoniais anuais presentes no site da Conab.

Para a previsão de produtividade, o modelo treinado utiliza o NDVI como label, sendo as  demais variáveis coletadas complementares, atuando como as features preditivas.

A escolha do NDVI como label, em vez da produtividade final diretamente, fundamenta-se na sua forte correlação com a saúde e o vigor da vegetação em estágios fenológicos chave. Embora a produtividade seja o objetivo final da previsão, o NDVI oferece uma medida quantitativa e sensível das condições da cultura ao longo do seu ciclo de desenvolvimento. Ao modelar a relação entre as diversas features e o NDVI, o programa aprende a identificar padrões que indicam um desenvolvimento vegetal promissor (ou não).

A lógica subjacente é que um NDVI elevado e sustentado durante períodos críticos do crescimento da cultura está intrinsecamente ligado a um maior potencial de produtividade futura. 

## 📊 ANÁLISE EXPLORATÓRIA DOS DADOS

A análise exploratoria teve como objetivo a avaliação da qualidade dos dados, informando as decisões subsequentes de pré-processamento e engenharia de features para otimizar o desempenho dos modelos de machine learning.

![AED](https://github.com/Ioiofmanzali/FIAP_FASE_5_SPRINT_2/blob/main/assets/menu_principal.JPG)
Observação: A figura apresentada tem como objetivo ilustrar a aparência geral do menu. O menu completo contem itens adicionais que não foram incluídos na imagem para fins de clareza e concisão.

## 📈 TREINAMENTO E ESCOLHA DO MELHOR MODELO DE ML

O projeto utiliza os modelos com o objetivo de encontrar a combinação que oferece o melhor desempenho de generalização para os dados, ou seja, que consegue fazer previsões precisas em dados não vistos durante o treinamento de regressão supervisionada para prever a produtividade agrícola. 

Os modelos implementados são:

1. Linear Regression

    Hiperparâmetros: não se aplica

2. Support Vector Regression (SVR)

    Hiperparâmetros:
      * C: 0.1, 1 e 10 (valores menores de C permitem maior tolerância a erros - maior viése e menor variância).
      * Kernels: 'rbf', 'linear' e 'poly' 

3. Random Forest Regressor (RandomForest)

    Hiperparâmetros:
      * n_estimators: 100 a 200 
      * max_depth: None a 10 
      * min_samples_split: 2 e 5 

4. Gradient Boosting Regressor

    Hiperparâmetros:
      * n_estimators: 100 e 200.
      * learning_rate: 0.01 e 0.1
      * max_depth: 3 e 5

5. Ridge

    Hiperparâmetros: 
      * alpha: 0.1, 1.0, 10.0

6. Lasso

    Hiperparâmtros:
      * alpha: 0.1, 1.0, 10.0

7. ElasticNet
  
    Hiperparâmetros: 
      * alpha: 0.1, 1.0, 10.0
      * L1_ratio: 0.2, 0.5, 0.8

8. DecisionTreeRegressor

    Hiperparâmetros: 
      * max_depth: None, 5, 10

9. KNeighborsRegressor

    Hiperparâmetros: 
      * n_neighbors: 3, 5, 7

10. AdaBoostRegressor

    Hiperparâmetros
      * n_estimators': 50, 100
      * learning_rate: 0.01, 0.1

Método selecionado para selecionar o 'melhor modelo' com os 'melhores hiperparâmetros': GridSearchCV

Métrica utilizada para seleção do modelo: RMSE

Os dados sao utilizados para treinamento em um ou mais modelos selecionados pelo usuário, seus resultados são comparados e o "melhor modelo" com os "melhores parâmetros" é selecionado com base no menor RMSE, apos otimização dos hiperparâmetros utilizando o GridSearchCV.

![image](https://github.com/Ioiofmanzali/FIAP_FASE_5_SPRINT_2/blob/main/assets/treinamento.JPG)

## 💹 ESTIMATIVA DE PRODUTIVIDADE

Para esta previsão, o melhor modelo modelo treinado com os dados históricos e os melhores hiperparâmetros ajustados (DecisionTreeRegressor - max_depth: None  e RMSE de 1094.79).  
A saída deste processo consistiu em estimativas quantitativas da produtividade para um horizonte temporal futuro específico (5 anos), fornecendo insights cruciais para o planejamento estratégico e a tomada de decisões proativas dentro do cenário do desafio. A acurácia dessas previsões está intrinsecamente ligada à qualidade dos dados futuros utilizados e à capacidade do modelo de generalizar padrões aprendidos no passado para novas situações.

![prod](https://github.com/Ioiofmanzali/FIAP_FASE_5_SPRINT_2/blob/main/assets/est_prod.JPG)

## 🔗 LINKS IMPORTANTES

[IBGE](https://sidra.ibge.gov.br/tabela/839)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
[INMET](https://portal.inmet.gov.br/dadoshistoricos)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[CONAB](https://www.conab.gov.br/info-agro/custos-de-producao/planilhas-de-custo-de-producao/item/16269-serie-historica-custos-milho-2-safra-2005-a-2021)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[SATVEG](&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)

## 📣 PRÓXIMOS PASSOS
REESCREVER TB

Para essa primeira versão foi selecionado o município de Sorriso, localizado no Estado do Mato Grosso e a série histórica de dados da safra do milho de 2015 a 10 de fevereiro de 2025.

o programa foi desenvlvido para ser escalável, portanto futuras versões poderão incuir: 

* Escalabilidade para outras localidades e culturas: 
Isso envolverá garantir que os dados para novas localidades e culturas sejam carregados corretamente da API Oracle e que o processo de treinamento e previsão possa ser generalizado.

* Inclusão de novas features: 
Dados de tipo de solo, uso de agrotóxicos e adjuvantes, tipos de cultivares, dentre outros.

* Melhoria da interface do usuário: 
A interface poderia ser aprimorada com mais visualizações, explicações e feedback para o usuário.

* Monitoramento e retreinamento dos modelos: Os modelos de machine learning podem se degradar com o tempo à medida que novos dados ficam disponíveis.

Os próximos passos se concentrarão em refinar e expandir as funcionalidades existentes para criar uma solução ainda mais robusta e precisa.

## :octocat: CONTRIBUIÇÕES AO PROJETO

Ficamos muito felizes com a sua contribuição e valorizamos cada sugestão e esforço dedicado a aprimorá-lo.

Como Contribuir: 

* Clique no botão "Fork" no canto superior direito desta página para criar uma cópia do repositório na sua conta do GitHub.

* Clone o repositório forkado para o seu ambiente de desenvolvimento local.

* Crie uma branch separada para a sua contribuição, desenvolva suas modificações e realize os commits necessários na sua branch.

* Quando suas alterações estiverem prontas, envie um Pull Request do seu fork para a branch main deste repositório.

Seu Pull Request será revisado pela equipe e, se tudo estiver correto, será aceito e suas contribuições serão integradas ao projeto 😃!

## COMO RODAR O PROGRAMA A PARTIR DO VSCODE

1. Abrir o Terminal no VS Code
     No menu superior, clique em Terminal e depois em Novo Terminal ou utilize o atalho "CTRL J". Isso abrirá um painel de terminal na parte inferior da janela do VS Code.
     
2. No terminal digite os comandos cd e run para abrir o arquico e, em seguida, o navegador onde o aplicativo será aberto:
 
 ** após executar o comando streamlit run, o Streamlit irá iniciar um servidor local e abrir automaticamente o seu aplicativo em uma nova aba do seu navegador web padrão.
 
 ** também aparecerá no terminal o endereço local onde o aplicativo está rodando (pode copiar e colar esse endereço no seu navegador, caso ele não abra automaticamente).

![strun](https://github.com/user-attachments/assets/bc0aa814-3564-406c-8c84-c6969ddecbe3)
Obs.: URLs geradas de forma automática pelo Streamlit

## 📁 Estrutura de pastas

- <b>assets</b>: imagens utilizadas no projeto e documentação
  
- <b>src</b>: códigos principais do programa
  
- <b>README.md</b>: guia e explicação geral sobre o projeto

## 🗃 Histórico de lançamentos

* 0.1.0 - 18/04/2025
    

## 📋 Licença

<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"><p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/agodoi/template">MODELO GIT FIAP</a> por <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://fiap.com.br">Fiap</a> está licenciado sobre <a href="http://creativecommons.org/licenses/by/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">Attribution 4.0 International</a>.</p>
