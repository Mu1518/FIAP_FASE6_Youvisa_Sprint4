# FIAP - Faculdade de Informática e Administração Paulista

<p align="center">
<a href= "https://www.fiap.com.br/"><img src="assets/logo-fiap.png" alt="FIAP - Faculdade de Informática e Administração Paulista" border="0" width=40% height=40%></a>
</p>

<br>

#  **ENTERPRISE CHALLENGE - SPRINT 3 YOUVISA**

![capa]

## Grupo 34

## 👨‍🎓 Integrantes: 
- <a href="https://www.linkedin.com/in/jonatasgomes">Jônatas Gomes Alves</a>
- <a href="https://www.linkedin.com/in/iolanda-helena-fabbrini-manzali-de-oliveira-14ab8ab0">Iolanda Helena Fabbrini Manzali de Oliveira</a>
- <a href="https://https://www.linkedin.com/in/murilo-nasser-563875323/">Murilo Carone Nasser</a> 
- <a href="https://www.linkedin.com/in/pedro-eduardo-soares-de-sousa-439552309">Pedro Eduardo Soares de Sousa</a>
- <a href="https://www.linkedin.com/in/amanda-fragnan-b61537255">Amanda Fragnan<a>

## 👩‍🏫 Professores:
### Tutor(a) 
- <a href="https://www.linkedin.com/in/leonardoorabona">Leonardo Ruiz Orabona</a>
### Coordenador(a)
- <a href="https://www.linkedin.com/company/inova-fusca">Andre Godoi Chaviato</a>

---

## 📑 Sumário

- [Sobre o Projeto](#-sobre-o-projeto)
- [Objetivos da Sprint 4](#-objetivos-da-sprint-4)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Arquitetura da Solução](#-arquitetura-da-solução)
- [Fluxo de Agentes Inteligentes](#-fluxo-de-agentes-inteligentes)
- [Processamento de Linguagem Natural (NLP)](#-processamento-de-linguagem-natural-nlp)
- [Registro de Interações e Logs](#-registro-de-interações-e-logs)
- [Governança e Segurança de IA](#-governança-e-segurança-de-ia)
- [Arquitetura de Banco de Dados](#-arquitetura-de-banco-de-dados)
- [Estrutura de Pastas](#-estrutura-de-pastas)
- [Fluxo Operacional da Plataforma](#-fluxo-operacional-da-plataforma)
- [Principais Funcionalidades](#-principais-funcionalidades)
- [Demonstração da Plataforma](#-demonstração-da-plataforma)
- [Como Executar o Projeto](#-como-executar-o-projeto)
- [Contribuições ao Projeto](#-contribuições-ao-projeto)
- [Histórico de Lançamentos](#-histórico-de-lançamentos)
- [Licença](#-licença)
```

---

## 🔍 Sobre o Projeto

O **YOUVISA Sprint 4** representa a evolução da plataforma para um modelo de atendimento inteligente integrado. Nesta fase, o foco está em conectar os módulos desenvolvidos anteriormente — acompanhamento de processos, chatbot e automações — em uma arquitetura única, capaz de interpretar solicitações, consultar informações e registrar interações em tempo real. A proposta central é transformar o sistema em uma plataforma digital escalável, eficiente e orientada à experiência do usuário.

---

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)
![AWS](https://img.shields.io/badge/AWS-Textract_&_Rekognition-FF9900?logo=amazonaws)
![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=google)


---

## 🛠 Tecnologias Utilizadas

### Frontend
- [Next.js 15 (App Router)](https://nextjs.org/) + React 19  
- Tailwind CSS v4  
- TypeScript  

O Next.js é um framework React amplamente utilizado para construção de aplicações web modernas, oferecendo recursos como **renderização no servidor (SSR), geração estática de páginas e roteamento otimizado**, melhorando desempenho e experiência do usuário.

---

### Backend & Serviços
- Python 3.12  
- FastAPI  
- PostgreSQL (Neon Cloud)  
- Autenticação baseada em JWT  

O backend foi desenvolvido utilizando **FastAPI**, framework moderno e de alto desempenho para criação de APIs em Python, responsável por gerenciar os processos, autenticação e integração com os serviços externos.

---

### Inteligência Artificial & Serviços em Nuvem

- [Google Gemini API](https://ai.google.dev/) — responsável pelo processamento de linguagem natural (NLP) e pelas respostas conversacionais do chatbot  
- [AWS Textract](https://aws.amazon.com/pt/textract/) — utilizado para **extração automática de dados de documentos (OCR semântico)**  
- [AWS Rekognition](https://aws.amazon.com/pt/rekognition/) — utilizado para **validação biométrica por comparação facial**

Esses serviços permitem automatizar tarefas como **extração de dados de documentos, validação de identidade e atendimento inteligente ao cliente**, aumentando a eficiência e confiabilidade da plataforma.

---
## 🏗 Arquitetura da Plataforma

A plataforma **YouVisa** foi projetada seguindo uma arquitetura moderna baseada na separação entre **frontend, backend e serviços cognitivos em nuvem**, garantindo escalabilidade, segurança e facilidade de manutenção.

- **Frontend:** desenvolvido em **Next.js 15 + React 19 + TypeScript**, responsável pela interface do usuário, dashboards e acompanhamento dos processos.

- **Backend:** implementado em **Python 3.12 com FastAPI**, responsável pelas regras de negócio, controle do fluxo de processos, autenticação e integração com serviços externos.

- **Banco de Dados:** **PostgreSQL hospedado no Neon.tech**, utilizando **SQL puro** para maior controle e desempenho nas consultas.

- **Arquitetura Event-Driven:** mudanças de status dos processos geram eventos automáticos que acionam notificações, auditoria e atualização das interfaces do sistema.

- **Serviços de Inteligência Artificial:** integração com **Amazon Textract** (OCR de documentos), **Amazon Rekognition** (validação biométrica) e **Google Gemini** (chatbot com NLP), permitindo automação e suporte inteligente ao usuário.

Essa arquitetura permite que o sistema ofereça **automação, rastreabilidade e maior eficiência no acompanhamento de processos de visto**.

---

## 🚀 Uso Estratégico de Inteligência Artificial

A plataforma YouVisa utiliza Inteligência Artificial em múltiplas camadas do sistema para aumentar a eficiência operacional, reduzir erros humanos e melhorar a experiência do usuário durante o acompanhamento do processo de visto.

As principais aplicações de IA na solução são descritas a seguir:

### 1️⃣ Extração de Dados do Passaporte (OCR / Visão Computacional)

Utilizando o serviço **Amazon Textract**, o sistema é capaz de processar automaticamente o passaporte enviado pelo usuário logo após o upload.

A tecnologia de OCR permite extrair informações estruturadas do documento, como:

- Nome completo  
- Número do documento  
- Data de expiração  

Esses dados são automaticamente comparados com as informações preenchidas no sistema, permitindo validar inconsistências e reduzir erros de digitação, acelerando o processo de análise documental.

---

### 2️⃣ Validação Biométrica por Comparação Facial

Para reforçar a segurança da plataforma, utilizamos o serviço **Amazon Rekognition**, que realiza a comparação biométrica entre a foto enviada pelo usuário e a foto presente no passaporte.

A funcionalidade **Compare Faces** calcula o nível de similaridade entre as imagens. Caso o índice ultrapasse o limite de confiança configurado no sistema, a identidade é validada automaticamente, reduzindo a necessidade de verificação manual pela equipe administrativa.

---

### 3️⃣ Atendimento Inteligente com Chatbot (LLM + NLP)

O sistema incorpora um **Chatbot baseado em Inteligência Artificial**, integrado à API do **Google Gemini**, que oferece atendimento automatizado 24 horas por dia.

Por meio de **Processamento de Linguagem Natural (NLP)**, o chatbot é capaz de compreender diferentes formas de perguntas feitas pelos usuários, como:

- "O que ainda falta enviar no meu processo?"
- "Qual é o status do meu visto?"
- "O que significa documentos pendentes?"

A IA interpreta a intenção da pergunta e responde utilizando uma linguagem simples e acessível.

Para garantir segurança e confiabilidade, foram implementados **mecanismos de governança (guardrails)** que impedem a IA de:

- inferir prazos de aprovação
- tomar decisões institucionais
- prometer resultados de processos consulares

Dessa forma, a IA atua apenas como **assistente informativo**, traduzindo os estados técnicos do sistema para o usuário.

---

### 4️⃣ Contextualização de Respostas com Dados do Usuário (RAG)

O chatbot também utiliza uma abordagem inspirada em **Retrieval-Augmented Generation (RAG)** para enriquecer suas respostas com dados reais do sistema.

Quando o usuário faz perguntas específicas sobre seu próprio processo, como:

> "Qual é o status do meu processo?"

o sistema solicita **autenticação segura via código OTP enviado por e-mail**.

Após a autenticação, o backend recupera as informações do processo diretamente do banco de dados e as inclui como contexto na consulta enviada ao modelo Gemini.

Isso permite que o chatbot forneça respostas **precisas, contextualizadas e personalizadas**, evitando respostas genéricas ou imprecisas.
---

## 🗄️ Arquitetura de Banco de Dados

O projeto utiliza um banco de dados relacional robusto hospedado na nuvem: **PostgreSQL através do serviço Neon.tech**. Todas as integrações a ele são feitas no backend em Python via SQL puro estruturado (sem uso de ORMs), visando entregar o mais alto desempenho com o controle estrito das interações.

**Tabelas implementadas para suportar a complexidade do sistema:**
- `usuarios`: Cadastro fundamental dos clientes, autenticados sem senha (passwordless) unicamente por código OTP.
- `funcionarios`: Administradores e operadores internos responsáveis pela gerência da plataforma.
- `codigos_otp`: Tokens efêmeros utilizados para o acesso tanto de clientes pelo website/bot, quanto por admins.
- `processos`: Modelo central guardando as instâncias de solicitações de vistos, monitoradas em máquina de estados rigorosa na sprint 3.
- `documentos`: Arquivos e comprovantes vinculados aos processos, validáveis tanto por humanos quanto por algoritmos de IA na nuvem AWS.
- `transicoes_processo`: Tabela de auditoria garantindo que todo "pulo de etapa" (state transition) seja rastreável, listando responsável, justificativa e o timestamp.
- `notificacoes`: Gerencia todos os disparos transacionais baseados em evento (event-driven) quando há mudanças nos processos.

---


## 📁 ESTRUTURA DE PASTAS

- <b>assets</b>: imagens utilizadas no projeto

- <b>src</b>: Arquivos do sistema backend, responsáveis pela API, lógica do sistema e integração com banco de dados e IA e Arquivos do sistema frontend, responsáveis pela interface do usuário

- <b>docs</b>: documentação técnica em PDF (Relatório do projeto e o Fluxo de Estados)

- <b>README.md</b>: guia e explicação geral sobre o projeto

---
## 🔄 Fluxo de Estados do Processo
O sistema YouVisa utiliza uma **máquina de estados** para controlar o ciclo de vida de cada solicitação de visto.  
Cada transição de estado é registrada no backend e pode gerar eventos automáticos, como envio de e-mails e atualização do painel do cliente.
![fluxo de estado](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/fluxo_estados.png)

Fluxo principal:

Recebido → Em Análise → Docs Pendentes → Em Análise → Em Processamento → Aprovado / Rejeitado

📄 Documentação completa:  
[Fluxo de Estados do Processo](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/docs/FLUXO_DE_ESTADOS.md)
--- 
## ✨ Principais Funcionalidades da Plataforma

- Cadastro e autenticação via OTP
- Upload de documentos para processos de visto
- Máquina de estados para controle do processo
- Validação automática de documentos com IA
- Comparação biométrica com AWS Rekognition
- Notificações automáticas por e-mail
- Chatbot inteligente para consulta de processos

## 🖥️ Demonstração da Plataforma

Esta seção apresenta uma visão prática da plataforma **YouVisa** desenvolvida na Sprint 3.  
A seguir são exibidas as principais funcionalidades da aplicação, incluindo a experiência do usuário, o fluxo de criação de processos e as ferramentas administrativas apoiadas por Inteligência Artificial.

---

## 🌐 Experiência do Usuário — Portal do Cliente

### Página Inicial e Criação de Conta

A página inicial centraliza os principais serviços da plataforma e orienta o usuário no início do processo de solicitação de visto.

![Website](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/01.website.png)

Caso o cliente ainda não possua uma conta, ele pode realizar um cadastro simples informando **nome, telefone e e-mail**.

![Criar Conta](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/02.criar_conta_cliente.png)

Para garantir segurança no acesso, o sistema utiliza autenticação **OTP (One-Time Password)** enviada por e-mail.

![Verificar Email](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/03.verificar_email.png)

Após o envio da solicitação de login, o usuário recebe o código de verificação em seu e-mail para validar o acesso à plataforma.

![Código enviado](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/04.codigo_enviado.png)

Uma vez autenticado, o cliente passa a ter acesso ao painel onde pode visualizar e acompanhar seus processos de solicitação de visto.

![Processos Cliente](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/05.processos_cliente.png)

---

### Abertura de um Novo Processo

O cliente pode iniciar um novo processo diretamente pela plataforma, enviando os documentos necessários para análise.

![Novo Processo](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/06.novo_processo.png)

O sistema permite o **upload estruturado de documentos essenciais**, garantindo organização e padronização das informações enviadas.

![Upload de Docs](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/07.upload_documentos.png)

Após o envio dos documentos, o processo passa automaticamente para a etapa de **análise**, onde será avaliado pela equipe administrativa e pelos mecanismos de validação automatizada do sistema.

![Processo em análise](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/08.processo_analise.png)

---

## ⚙️ Painel Administrativo e Uso de Inteligência Artificial

A plataforma também conta com um **painel administrativo completo**, que permite à equipe interna acompanhar, validar e atualizar os processos dos clientes.

![Dashboard Admin](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/09.admin_funcionario.png)

Nesse ambiente, os administradores podem:

- analisar documentos enviados
- atualizar o status do processo
- validar informações automaticamente utilizando IA
- acompanhar o histórico de transições do processo

---

### Validação Automatizada de Documentos com IA

Um dos principais recursos do sistema é a funcionalidade **Aprovar com IA**, que utiliza o serviço **Amazon Textract** para extrair automaticamente dados do passaporte enviado pelo cliente.

O sistema analisa campos como:

- Nome completo  
- Número do documento  
- Data de expiração  

Essa verificação automatizada reduz erros de digitação e agiliza o processo de validação.

![Aprovar Doc por IA](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/10.aprovar_documento_ia.png)

---

### Verificação de Identidade por Comparação Facial

Para aumentar a segurança do processo, o sistema utiliza o **Amazon Rekognition** para realizar **comparação biométrica entre a foto enviada pelo usuário e a foto presente no passaporte**.

Caso o nível de similaridade esteja dentro da margem de segurança definida, a identidade é validada automaticamente.

![Validar Foto IA](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/11.validar_fotos_ia.png)

Caso a validação identifique inconsistências ou baixa similaridade entre as imagens, o sistema solicita ao usuário o **reenvio da fotografia**, garantindo maior confiabilidade no processo.

![Usuário reenviar foto](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/12.usuario_reenviar_foto.png)

---

## 📩 Comunicações Automatizadas

A plataforma utiliza uma arquitetura **orientada a eventos (event-driven)**.  
Sempre que ocorre uma mudança relevante no status do processo, o sistema dispara automaticamente notificações ao cliente.

Após a validação completa dos documentos e etapas do processo, o cliente é informado quando o visto é aprovado.

![Visto aprovado](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/13.visto_aprovado.png)

Além disso, notificações também são enviadas por **e-mails HTML interativos**, informando de forma clara o novo status do processo e eventuais ações necessárias.

![Email Visto Aprovado](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/14.email_visto_aprovado.png)

---

## 🤖 Atendimento Inteligente via Chatbot

A plataforma também conta com um **Chatbot baseado em IA**, disponível para auxiliar os usuários em tempo real.

O assistente é capaz de responder perguntas como:

- Qual o status do meu processo?
- Está faltando algum documento?
- Qual é o próximo passo do meu pedido de visto?

![Login Chatbot](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/15.login_chatbot.png)

Para acessar informações específicas do processo, o chatbot solicita **autenticação segura via OTP**, garantindo que apenas o titular tenha acesso aos dados.

Após autenticado, o sistema consulta as informações do banco de dados e fornece respostas contextualizadas ao usuário.

![Atendimento Chatbot](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/16.chatbot_atendimento.png)
---

## **🚀 Como Executar o Projeto**
## ⚙️ Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

- Node.js 18+
- Python 3.12+
- Git
- Conta AWS configurada
- Chave da API Gemini
O projeto é particionado em Frontend (Next.js) e Backend (FastAPI). Ambas as etapas precisam rodar.

### 1. Configurando e Rodando o Backend (FastAPI)
```bash
# 1. Entre na pasta backend pelo terminal
cd backend

# 2. Crie e ative um ambiente virtual 
python -m venv venv
# No mac/linux: source venv/bin/activate 
# No Windows: venv\Scripts\activate

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Configure o arquivo de variáveis .env
# Necessário definir chaves do banco (DATABASE_URL), AWS (Textract/Rekognition), SMTP e Gemini (GEMINI_API_KEY).
# Siga a padronização exibida dentro do backend/CLAUDE.md

# 5. Execute o servidor de backend que responderá na porta 8000
python3 -m uvicorn main:app --reload
```

### 2. Configurando e Rodando o Frontend (Next.js)
```bash
# 1. Em outra aba de seu terminal, vá a pasta do app React
cd frontend

# 2. Instale as dependências Node
npm install

# 3. Configure a porta para a API
# O único env vital neste caso e apontar NEXT_PUBLIC_API_URL=http://localhost:8000
# Para a IA flutuante não falhar verifique estar com o Gemini API Keys também por lá, caso requisitado.

# 4. Inicie o sistema
npm run dev

# Abra http://localhost:3000 em seu navegador
```
---
##  :octocat: CONTRIBUIÇÕES AO PROJETO

Ficamos muito felizes com a sua contribuição e valorizamos cada sugestão e esforço dedicado a aprimorá-lo.

Como Contribuir: 

* Clique no botão "Fork" no canto superior direito desta página para criar uma cópia do repositório na sua conta do GitHub.

* Clone o repositório forkado para o seu ambiente de desenvolvimento local.

* Crie uma branch separada para a sua contribuição, desenvolva suas modificações e realize os commits necessários na sua branch.

* Quando suas alterações estiverem prontas, envie um Pull Request do seu fork para a branch main deste repositório.

Seu Pull Request será revisado pela equipe e, se tudo estiver correto, será aceito e suas contribuições serão integradas ao projeto 😃!

---
## **VIDEO EXPLICATIVO**

Assista ao vídeo e veja a ideia central da plataforma

[Clique para Assistir](https://youtu.be/lYtCkQpfYj4)
## **VIDEO DEMONSTRATIVO**

Assista ao vídeo e veja como faz para se cadastar e como funciana pagina de administrador(funcionário)

[Clique para Assistir](https://youtu.be/IHyLbsFLwzo])
## 🗃 Histórico de lançamentos

*  1.0.0 - 07/03/2026
    

## 📋 Licença

<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"><p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/agodoi/template">MODELO GIT FIAP</a> por <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://fiap.com.br">Fiap</a> está licenciado sobre <a href="http://creativecommons.org/licenses/by/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">Attribution 4.0 International</a>.</p>
