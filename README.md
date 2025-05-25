# FIAP - Faculdade de Informática e Administração Paulista

<p align="center">
<a href= "https://www.fiap.com.br/"><img src="assets/logo-fiap.png" alt="FIAP - Faculdade de Informática e Admnistração Paulista" border="0" width=40% height=40%></a>
</p>

<br>

# PROJETO - :artificial_satellite: SPRINT 3 INGREDION  

![capa](assets/capa.jpeg)

## Grupo 9

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

Documentação Técnica do Projeto "CHALLENGE INGREDION - Sprint 3"

![Versão 2.0.0](https://img.shields.io/badge/Vers%C3%A3o%202.0.0-gray?style=flat) 

Autores: Jonatas Gomes, Iolanda Manzali, Murilo Nasser, Pedro Sousa, Amanda Fragnan

## 🔍 SOBRE O PROJETO

Este projeto, referente a terceira fase do Challenge Ingredion do Curso de Inteligência Artificial da FiAP (1TIAO), tem como foco o desenvolvimento de um modelo de Inteligência Artificial para cálculo de previsão da produtividade agrícola, utilizando NDVI (Índice de Vegetação Normalizada), dados climáticos, de produtividade e custo.
            
Os datasets de NDVI, custos e produtividade não possuem valores ausentes. Os dataset do INMET utilizados no programa foram previamente tratados e limpos antes de serem carregados via APEX para a nuvem Oracle. Isso ocorreu pela natureza diversa das formatações e pela necessidade de padronização dos dados para garantir a integridade e a precisão das análises. Os valores faltantes foram tratados com a média temporal dos dados disponíveis, e os dados foram convertidos para o formato necessário para análise nessa aplicação.
            
O projeto foi desenvolvido em Python, utilizando as bibliotecas Streamlit, Pandas, NumPy, Scikit-learn, Plotly, Pickle, Os, Requests, Locale e Datetime.       

** obs: todo o código desse projeto foi escrito utilizando a IDE (VSCode).

### 🛠️ MELHORIAS IMPLEMENTADAS EM RELAÇÃO À VERSÃO 1.0.0

  * NOVOS DATASETS:
     - CONAB: custos de produção das culturas de Triticale, Trigo, Amendoim, Batata-inglesa, Feijão (1a safra), Tomate, Sorgo e Soja.
     - INMET: dados INMET das estações meterreológicas A001 (Brasilia), A020 (Pedro Afonso), A025 (Rio Verde), A042 (Barreiras), A426 (Guanambi), A839 (Passo Fundo), A843 (Dois Vizinhos), A852 (São Luiz Gonzaga), A853 (Cruz Alta), A859 (Caçador) e A721 (Dourados) 
     - SIDRA/IBGE: dados agricolas para as culturas de Triticale, Trigo, Amendoim, Batata-inglesa, Feijão (1a safra), Tomate, Sorgo e Soja.


    * MODULARIZAÇÃO DA APLICAÇÃO:
   
    A nova estrutura da aplicação encontrase modularizada da seguinte forma:
                - app.py: script inicial para a aplicação, arquivo principal que direciona as outras páginas.
    
                - app_carga.py: permite o upload de arquivos CSV através de uma interface Streamlit, validando e enviando dados agrícolas (NDVI, produtividade e meteorológicos) para uma API Oracle. Ele faz o pré-processamento dos dados, exibe uma prévia e realiza a carga em lote com tratamento de erros e feedback ao usuário.
    
                - app_dados.py: realiza a conexão com uma API Oracle REST para coletar dados agrícolas, como NDVI, produtividade, dados meteorológicos e custos. Ele faz o tratamento das requisições, lida com paginação automática e retorna os dados organizados em DataFrames para análise no Streamlit.
    
                - app_links.py: exibe uma página no Streamlit com links úteis para acesso a bases de dados agrícolas e meteorológicos, como IBGE, INMET, CONAB e SATVEG. Ele serve como um atalho rápido para fontes de dados essenciais no contexto do projeto.
    
                - app_produtividade.py: realiza a estimativa de produtividade agrícola utilizando um modelo de machine learning treinado, acessível por meio de uma interface Streamlit. Ele permite ao usuário selecionar localidade, cultura, ano, mês e área plantada, realizando a previsão da produtividade e calculando a produção total estimada.
    
                - app_sobre.py: apresenta informações sobre o projeto de previsão de produtividade agrícola, desenvolvido no Challenge Ingredion da FIAP, explicando os objetivos, metodologia, tratamento dos dados e as bibliotecas utilizadas. Também apresenta os membros da equipe e os próximos passos planejados para evolução e expansão do projeto.
    
                - app_treinamento.py: permite treinar diversos modelos de machine learning supervisionados para previsão de produtividade agrícola, utilizando dados carregados da base Oracle. O usuário seleciona os modelos desejados, e o sistema realiza ajuste de hiperparâmetros, avalia o desempenho e salva o melhor modelo para ser utilizado nas previsões futuras.
    
### ❗ PRÉ-REQUISITOS 

* Ambiente de desenvolvimento compatível com Python, como VSCode ou PyCharm.

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

### Tratamento de Erros e Dados Ausentes

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

![pagina_inicial](assets/app_inicio.png)

* **Sobre o Projeto**: Fornece informações contextuais sobre o projeto, o time de desenvolvimento e os planos futuros.

* **Links Importantes**: Contém os links relevantes do projeto.

* **Carga de Dados**: Usado para fazer upload de dados em formato CSV para o banco de dados Oracle para ser usado via Rest API no treinamento dos modelos de IA.

* **Análise Exploratória**: Permite visualizar os dados carregados da API Oracle, realizar uma análise básica de limpeza e visualizar séries históricas através de gráficos interativos. Também oferece a opção de baixar os dados em formato CSV.

* **Treinamento de Modelos**: Permite ao usuário selecionar e treinar diferentes modelos de regressão supervisionada utilizando os dados de produtividade. Exibe os resultados do treinamento e salva os modelos treinados.

* **Estimativa de Produtividade**: Permite ao usuário inserir parâmetros (localidade, cultura, ano e mês de plantio, área plantada) e obter uma previsão da produtividade utilizando o melhor modelo treinado.

A interface utiliza componentes do Streamlit como st.markdown, st.subheader, st.write, st.dataframe, st.plotly_chart, st.download_button, st.selectbox, st.multiselect, st.number_input, st.button, st.info, st.success, st.warning, st.error, st.expander, st.balloons e st.feedback para criar uma experiência mais  interativa para o usuário.

 ### Video Demonstrativo da inteface Streamlit
 
 [LINK DO VIDEO DEMONSTRATIVO](novo link a a ser feito)

## DATASETS

Com exceção dos arquivos do INMET, os demais datasets não possuem valores ausentes.

### INMET

Os datasets IMNET foram processados conforme o descrito a seguir:
  - Preenchimento de valores ausentes: Valores ausentes, representados por '-9999', '-9999.0', 'NA' ou '', substituídos pela média temporal da mesma hora e dia de outros anos. 
  - Repetição do código WMO (código especifico da estação metereolólgica) em todas as linhas, garantindo a uniformidade dessa informação.
  - Salvamento dos arquivos processados sem sobrescreve os originais
 A001 (Brasilia), A020 (Pedro Afonso), A025 (Rio Verde), A042 (Barreiras), A426 (Guanambi), A839 (Passo Fundo), A843 (Dois Vizinhos), A852 (São Luiz Gonzaga), A853 (Cruz Alta), A859 (Caçador) e A721 (Dourados). 


### NDVI
  - selecionados talhões aleatórios dos municipios de  Barreiras, Brasilia, Caçador, Cruz Alta, Dois Vizinhos, Dourados, Guanambi, Passo Fundo, Pedro Afonso, Rio Verde e Sorriso. 
Os criterios selecionados no site Satveg:
            * Índice: NDVI
            * Satélite: Terra e Aqua
            * QA: Marginal / Nuvem / Neve
            * Pré-filtragem: NoData / Nuvem
            * Filtros: SG4
    Obs: o QA neve foi selecionado para os estados da região Sul do Brasil.

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

* Estimativa de Produtividade: Permite ao usuário inserir informações sobre a localidade, cultura, ano e mês de plantio, e área plantada. Utiliza o melhor modelo treinado para prever a produtividade para as condições especificadas.

* Persistência de Modelos: Os modelos treinados são salvos localmente utilizando a biblioteca pickle, permitindo que sejam reutilizados sem a necessidade de retreinamento a cada execução da aplicação.
  
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

A análise exploratoria teve como objetivo a avaliação da qualidade dos dados, informando as decisões subsequentes de pré-processamento e engenharia de features para otimizar o desempenho dos modelos de Machine Learning.

## 📈 TREINAMENTO E ESCOLHA DO MELHOR MODELO DE ML

O projeto utiliza os modelos com o objetivo de encontrar a combinação que oferece o melhor desempenho de generalização para os dados, ou seja, que consegue fazer previsões precisas em dados não vistos durante o treinamento de regressão supervisionada para prever a produtividade agrícola. 

Os modelos implementados são:

![modelos](https://github.com/Ioiofmanzali/Sprint3_FIAP_Grupo09/blob/main/assets/modelos.JPG)

Método selecionado para selecionar o 'melhor modelo' com os 'melhores hiperparâmetros': GridSearchCV

Métrica utilizada para seleção do modelo: RMSE

Os dados sao utilizados para treinamento em um ou mais modelos selecionados pelo usuário, seus resultados são comparados e o "melhor modelo" com os "melhores parâmetros" é selecionado com base no menor RMSE, apos otimização dos hiperparâmetros utilizando o GridSearchCV.

![train](https://github.com/Ioiofmanzali/Sprint3_FIAP_Grupo09/blob/main/assets/aed.JPG)

## 💹 ESTIMATIVA DE PRODUTIVIDADE

Para esta previsão, o melhor modelo modelo treinado com os dados históricos e os melhores hiperparâmetros ajustados (GradientBoosting com RMSE de 1995.68).

A saída deste processo consistiu em estimativas quantitativas da produtividade para um horizonte temporal futuro específico (5 anos), fornecendo insights cruciais para o planejamento estratégico e a tomada de decisões proativas dentro do cenário do desafio. A acurácia dessas previsões está intrinsecamente ligada à qualidade dos dados futuros utilizados e à capacidade do modelo de generalizar padrões aprendidos no passado para novas situações.

![prod](https://github.com/Ioiofmanzali/Sprint3_FIAP_Grupo09/blob/main/assets/prod.JPG))

## 🔗 LINKS IMPORTANTES

[IBGE](https://sidra.ibge.gov.br/tabela/839)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
[INMET](https://portal.inmet.gov.br/dadoshistoricos)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[CONAB](https://www.conab.gov.br/info-agro/custos-de-producao/planilhas-de-custo-de-producao/item/16269-serie-historica-custos-milho-2-safra-2005-a-2021)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[SATVEG](&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)

## 📣 PRÓXIMOS PASSOS

Este é um projeto em evolução. Na sua versão 1.0.0 foi selecionada a cultura de milho da cidade de  Sorriso, localizada no estado do Mato Grosso.

Para a versão 2.0.0, expandimos o escopo para incluir outras culturas e municípios do território nacional.

O programa foi construido para ser escalável e para novas versões esperamos acrescentar dados relacionados a tipo de clima e solo, a partir de coordenadas geográficas.
            

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
 
 ** após executar o comando streamlit run app.py, o Streamlit irá iniciar um servidor local e abrir automaticamente o seu aplicativo em uma nova aba do seu navegador web padrão.
 
 ** também aparecerá no terminal o endereço local onde o aplicativo está rodando (pode copiar e colar esse endereço no seu navegador, caso ele não abra automaticamente).



## 📁 Estrutura de pastas

- <b>assets</b>: imagens utilizadas no projeto e documentação
  
- <b>src</b>: códigos principais do programa
  
- <b>README.md</b>: guia e explicação geral sobre o projeto

## 🗃 Histórico de lançamentos

* 0.1.0 - 18/04/2025
    

## 📋 Licença

<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"><p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/agodoi/template">MODELO GIT FIAP</a> por <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://fiap.com.br">Fiap</a> está licenciado sobre <a href="http://creativecommons.org/licenses/by/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">Attribution 4.0 International</a>.</p>
