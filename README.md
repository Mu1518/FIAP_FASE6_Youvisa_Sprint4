# FIAP - Faculdade de Informática e Administração Paulista

<p align="center">
<a href= "https://www.fiap.com.br/"><img src="assets/logo-fiap.png" alt="FIAP - Faculdade de Informática e Admnistração Paulista" border="0" width=40% height=40%></a>
</p>

<br>

#  **ENTERPRISE CHALLENGE - SPRINT 3 YOUVISA**

![capa]

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

## 🔍 SOBRE O PROJETO
O **PROJETO SPRINT 3 YOUVISA** marca a evolução da plataforma YouVisa para um sistema inteligente e maduro de acompanhamento de processos de imigração e vistos. Nesta fase, a plataforma deixa de ser apenas uma ferramenta de entrada de documentos para se tornar uma solução proativa, orientada a eventos (event-driven) e baseada em IA para gerenciar o ciclo de vida completo de cada solicitação.

Focamos na comunicação clara com o cliente: notificações automatizadas de mudança de estado, uma interface com a linha do tempo e um Chatbot IA inteligente que compreende as intenções do usuário e responde a dúvidas técnicas traduzindo-as para uma linguagem simples e acessível. A validação ágil de documentos por IA pela equipe administrativa reforça o fluxo operacional, escalando o atendimento.

![alt text](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![alt text](https://img.shields.io/badge/React-19-blue?logo=react)
![alt text](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi)
![alt text](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)
![alt text](https://img.shields.io/badge/AWS-Textract_&_Rekognition-FF9900?logo=amazonaws)
![alt text](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=google)

---

## 🚀 **USO ESTRATÉGICO DE INTELIGÊNCIA ARTIFICIAL**

Nós aplicamos Inteligência Artificial de ponta em múltiplas camadas do produto para garantir velocidade, precisão e segurança durante todo o andamento processual. É fundamental destacar os seguintes usos de IA:

### 1. Extração de Texto do Passaporte (OCR / Computer Vision)
- Usando **Amazon Textract**, o sistema backend do admin consegue processar o passaporte do usuário imediatamente após o upload.
- O texto e os dados tabulares são extraídos para validar informações vitais: confirmamos se o Nome Completo e a Data de Expiração extraídos conferem com o que foi preenchido no sistema automaticamente pelo Admin, agilizando aprovações e descartando inconsistências ou digitações incorretas.

### 2. Comparação Facial e Biometria de Foto
- Por meio do **Amazon Rekognition** (função *Compare Faces*), garantimos a identidade do solicitante comparando a foto de rosto que ele enviou espontaneamente com a foto biométrica impressa no passaporte carregado. Se a pontuação de similaridade atingir nossa margem de segurança configurada, a foto é identificada como a da mesma pessoa, sendo aprovada pela IA sem a necessidade de intervenção humana.

### 3. Atendimento Inteligente e NLP via Chatbot
- Implementado nativamente no frontend consumindo a API do **Google Gemini (LLM)**, fornecemos ao cliente um assistente 24/7.
- O chatbot processa através de processamento de linguagem natural (NLP) a intenção do usuário, entendendo perguntas abertas como “O que está faltando entregar?”, “Quando meu visto de estudante chega?”, "O que acontece na etapa de documentos pendentes?".
- Aplicamos as devidas proteções (guardrails): A IA não infere prazos precisos, nem toma decisões pela agência consular e nem faz promessas. Ela opera apenas traduzindo os estados técnicos para uma linguagem amigável.

### 4. RAG e Contexto com Usuário Logado (Status de Processo)
- O Chatbot foi enriquecido com a lógica avançada para injetar contexto (Retrieval-Augmented Generation / RAG conceitual) focada nos dados próprios do usuário logado.
- Caso o usuário faça perguntas específicas como "Qual o status do MEU processo?", o chatbot obriga sua autenticação na mesma interface amigável (enviando senha OTP paro email no ato da conversa).
- Uma vez autenticado, ele enriquece o contexto das requisições ao modelo Gemini injetando os históricos e status do banco de dados referenciando a conta logada do cliente. Isto faz com que a IA informe com total precisão como está o processo particular do cliente e quais as exatas pendências em falta.

---

## 🗄️ BANCO DE DADOS EM NUVEM (POSTGRESQL)

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

## 🖥️ PASSO A PASSO / DEMONSTRAÇÃO DO SISTEMA

*(Abaixo o registro imagético da plataforma YouVisa na Sprint 3).*

### Visão Geral da Home e Criação de Processos
- A Home page unifica serviços, informações adicionais e aciona imediatamente o cliente:
  <br/>![Website]((https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/01.website.png)

- O cliente que não tem conta fornece nome, telefone e email. Após, a inserção dos dados deve verificar o email para insere um PIN (OTP) enviado por email para validar a segurança:
  <br/>![Criar Conta](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/02.criar_conta_cliente.png)  <br/>![Verificar Email](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/03.verificar_email.png) <br/>![Código Enviado](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/04.codigo_enviado.png) <br/>![Processos Cliente](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/05.processos_cliente.png)

- Após efetuarAbertura de um processo, sendo possível gerar um upload estruturado de itens essenciais:
  <br/>![Novo Processo](assets/06.novo_processo.png)  <br/>![Upload de Docs](assets/07.upload_documentos.png)



##  :octocat: CONTRIBUIÇÕES AO PROJETO

Ficamos muito felizes com a sua contribuição e valorizamos cada sugestão e esforço dedicado a aprimorá-lo.

Como Contribuir: 

* Clique no botão "Fork" no canto superior direito desta página para criar uma cópia do repositório na sua conta do GitHub.

* Clone o repositório forkado para o seu ambiente de desenvolvimento local.

* Crie uma branch separada para a sua contribuição, desenvolva suas modificações e realize os commits necessários na sua branch.

* Quando suas alterações estiverem prontas, envie um Pull Request do seu fork para a branch main deste repositório.

Seu Pull Request será revisado pela equipe e, se tudo estiver correto, será aceito e suas contribuições serão integradas ao projeto 😃!


## 🗃 Histórico de lançamentos

* 1.0.0 - 03/11/2025
    

## 📋 Licença

<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"><p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/agodoi/template">MODELO GIT FIAP</a> por <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://fiap.com.br">Fiap</a> está licenciado sobre <a href="http://creativecommons.org/licenses/by/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">Attribution 4.0 International</a>.</p>
