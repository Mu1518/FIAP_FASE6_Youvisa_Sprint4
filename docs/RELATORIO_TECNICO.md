# Relatório Técnico: Arquitetura, Lógica de Status e Governança
**Projeto:** YouVisa - Sprint 3

## 1. Resumo Executivo
Este documento consolida as principais decisões de engenharia, arquitetura de software e lógicas de governança adotadas na Sprint 3 da plataforma YouVisa. O sistema evoluiu de um repositório de documentos processuais para uma plataforma baseada em eventos (*event-driven*), operando com rígidos controles de acesso e profunda integração com Inteligência Artificial para escala operacional e automatização de auditorias.

---

## 2. Decisões de Arquitetura

A arquitetura do YouVisa foi desenhada baseada na separação clara de responsabilidades entre cliente e servidor, priorizando performance, manutenibilidade e escalabilidade em nuvem.

### 2.1 Stack Tecnológico
- **Frontend (Apresentação e Lógica de Cliente):** Desenhado em **Next.js 15** (App Router) e **React 19**, mesclando componentes processados no servidor (Server Components) para garantir alta performance inicial de carregamento e componentes cliente para reatividade em formulários e dashboards. A estilização utiliza Tailwind CSS v4.
- **Backend (Regras de Negócio e APIs):** Desenvolvido inteiramente em **Python 3.12** acoplado ao poderoso **FastAPI** para entrega de endpoints REST de altíssimo desempenho e de documentação automatizada (OpenAPI). 
- **Banco de Dados Relacional:** Adotado **PostgreSQL** hospedado na infraestrutura em pé de nuvem **Neon.tech**. Uma premissa técnica determinante foi abdicar de ORMs (Object-Relational Mappers), adotando chamadas em **SQL Puro**. Isso confere controle absoluto sobre a performance das `queries` e uma compreensão mais profunda da modelagem por código.

### 2.2 Arquitetura Orientada a Eventos (Event-Driven)
O acoplamento central do projeto migrou para eventos disparados por mudanças de estados de processos. A gravação de uma transição de status emite gatilhos assíncronos que resultam em lógicas subsequentes isoladas, como disparos sistêmicos de E-mails com templates HTML amigáveis, eliminando dependência temporal excessiva no processo síncrono da API.

### 2.3 Serviços Cognitivos (Inteligência Artificial)
A plataforma absorve capacidades avançadas não-triviais ao integrar 3 vertentes de IA em nuvem para automação e segurança:
1.  **OCR em Passaportes:** Amazon Textract extrai textos estruturados sob demanda para validar de forma exata dados vitais (vencimentos e discrepâncias de nome).
2.  **Identidade Biométrica:** Amazon Rekognition injetado via AWS Boto3, que cruza fotografias tiradas pelo usuário (*selfie*) contra as fotos do chip/impressão do passaporte extraído, reduzindo fraude processual.
3.  **Chatbot e RAG:** Google Gemini orquestra NLP (Natural Language Processing) compreendendo as falas dos usuários. Para clientes autenticados, o Bot recebe contextos estruturados do banco de dados relacional transformando-os em respostas legíveis (técnica conceitual semelhante a Retrieval-Augmented Generation / RAG).

---

## 3. Lógica de Status e Processamento (Máquina de Estados)

A espinha dorsal da plataforma rege-se em uma lógica imutável das etapas de vistos, impedindo sob qualquer hipótese "saltos" não previstos em código. A regra é centralizada e gerida apenas pelo backend.

*   **Entrada de Pipeline:** `Recebido`, unicamente via POST de criação por usuários.
*   **Triagem:** `Em Análise`, acionável exclusivamente por usuários tipo `Funcionário`.
*   **Encaminhamento (Bifurcação):** 
    *   Para `Documentos Pendentes` (caso os laudos de IA ou revisão humana apontem inconformidade). Retorna a bola ao cliente para correções.
    *   Para `Em Processamento` (quando validados/autenticados os documentos e despachados).
*   **Fechamento (Logs Finais):** `Aprovado`, `Rejeitado` ou `Cancelado`. Fim da capacidade transacional do pipeline para o id em questão.

Toda transição requer que as validações obedeçam à matriz de adjacência aprovada em negócio. Modificadores estéticos no front-end (`ProcessoTimeline`) apenas escutam os retornos estritos do banco de dados, não definindo processos decisórios.

---

## 4. Governança, Auditoria e Segurança

O YouVisa foi desenhado para atenuar o viés de fraude migratória e facilitar rastros operacionais de todas as mutações sofridas pelos dados.

### 4.1 Login Restrito e Efêmero (Passwordless OTP)
Banimos do sistema senhas transacionais vulneráveis, vetando sua guarda. O acesso ocorre puramente pelo uso pareado de email único transacional gerando Tokens OTP (One-Time Password) temporários que expiram em minutos. 
O servidor empacota as sessões autorizadas em chaves via JSON Web Tokens (JWT) com validades restritas (24 horas) e *Claims* deterministas (Role Based Access Control - RBAC diferenciando "Usuário" de "Funcionário").

### 4.2 Single Source of Truth / Tabelas de Auditoria
Implementamos uma rastreabilidade estrita: a tabela `transicoes_processo`. 
Absolutamente todas as invocações à rota `PATCH /processos/{id}/status` são injetadas primariamente nessa tabela que assina os seguintes escopos de governança:
- **Timestamp:** Quando a mudança de rito se deu no sistema métrico global.
- **Responsabilidade:** Qual perfil/ID disparou a função transacional.
- **Justificativa da Transição:** Quaisquer `observacoes` anotadas (como "Passaporte Vencido e Ilegível" ou "Foto confirmada com confiabilidade de 99% pela IA").

### 4.3 Governance Limitada em IA (Guardrails)
Enquadramos os limites regulatórios da inteligência artificial:
- Nenhuma IA tem poder de fechar (*merge*) ou cancelar os processos unilateralmente sem revisão humana (*Human in the Loop*). O Rekognition e Textract auxiliam os botões de atalhos e sugerem métricas, mas a submissão via endpoint se consolida de um operador logado.
- Os *prompts* injetados na **API Gemini** via backend proíbem explicitamente inferências relativas a prazos consulares, políticas da embaixada, garantias de aprovação e estipulação ou dedução de preços. O modelo atua rigorosamente na tradução do glossário técnico diplomático para a linguística comum aplicável ao público final.
