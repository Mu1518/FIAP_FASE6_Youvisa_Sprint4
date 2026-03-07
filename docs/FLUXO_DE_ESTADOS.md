# 🔄 Fluxo de Estados do Processo de Vistos (Máquina de Estados)
**YouVisa - Sprint 3**

Este documento detalha o ciclo de vida de um processo de visto na plataforma YouVisa. O sistema adota uma arquitetura orientada a eventos (*event-driven*), onde cada transição de estado é auditada e atua como um gatilho para ações automatizadas, como o envio de notificações por e-mail e a atualização da linha do tempo no painel do cliente.

---

## 📊 Diagrama de Transição de Estados

As transições são rigidamente controladas pelo backend (FastAPI), impedindo que processos pulem etapas necessárias ou retornem a estados inválidos. 

![Fluxo de Estados](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/fluxo_estados.png)

---

## 🎯 Gatilhos e Ações Automatizadas (Event-Driven)

Abaixo estão as especificações do que acontece exatamente no **backend** cada vez que o status de um processo muda. Estas mudanças afetam imediatamente as visões e dados no **frontend**.

| 🏷️ Estado Atual | ➡️ Próximo Estado | 👤 Quem Dispara | ⚡ Gatilho Secundário / Ação Automatizada |
| :--- | :--- | :--- | :--- |
| `[N/A]` | `Recebido` | **Usuário** | <ul><li>**Auditoria:** Log na tabela `transicoes_processo`.</li><li>**Email:** "Recebemos sua solicitação".</li><li>**Dashboard:** Componente `ProcessoTimeline` inicia na primeira etapa.</li></ul> |
| `Recebido` | `Em Análise` | **Admin** | <ul><li>**Auditoria:** Log com motivo/observação.</li><li>**Email:** "Seu processo entrou em análise técnica."</li><li>**IA:** Habilita botões `Aprovar com IA` no dashboard admin para Passaporte e Foto.</li></ul> |
| `Em Análise` | `Docs Pendentes` | **Admin** | <ul><li>**Auditoria:** Log detalhando o documento ausente/inválido.</li><li>**Email:** Alerta solicitando upload de documentos faltantes.</li></ul> |
| `Docs Pendentes` | `Em Análise` | **Usuário** | <ul><li>**Auditoria:** Log (Upload de Documento).</li><li>**Frontend:** Atualiza contador de documentos no Card.</li></ul> |
| `Em Análise` | `Em Processamento` | **Admin** | <ul><li>**Gatilho:** IA validou com sucesso via `Textract`/`Rekognition` e Admin confirmou o envio ao consulado.</li><li>**Auditoria:** Log de transição.</li><li>**Email:** "Documentação validada! Processo enviado ao consulado."</li></ul> |
| `Em Processamento` | `Aprovado` | **Admin** | <ul><li>**Auditoria:** Visto aprovado e finalizado na plataforma.</li><li>**Email:** "Boas notícias! Seu visto foi APROVADO! 🥳"</li><li>**Frontend:** Timeline atinge o último passo em tom de sucesso (verde).</li></ul> |
| `Em Processamento` | `Rejeitado` | **Admin** | <ul><li>**Auditoria:** Log contendo a objeção consular.</li><li>**Email:** "Aviso importante sobre seu visto (Negado)."</li></ul> |
| `(Qualquer)` | `Cancelado` | **Admin** | <ul><li>**Auditoria:** Cancelamento manual ou abandono.</li><li>**Email:** "Notificação de Cancelamento de Processo."</li></ul> |

![Fluxo de Estados](https://github.com/Mu1518/FIAP_FASE5_Sprint3_Youvisa/blob/main/assets/diagrama_fluxo_estados.png)

---

## 🧠 Integrações Tecnológicas Relacionadas aos Estados

O avanço na máquina de estados é acelerado pelas seguintes ferramentas integradas ao YouVisa na Sprint 3:

### 1️⃣ Amazon Textract (OCR Inteligente)
Quando um processo está `Em Análise`, o funcionário pode utilizar IA para validar o passaporte:
*   Extrai: **Nome Completo** e **Data de Expiração**.
*   Compara automaticamente com os dados preenchidos no formulário (estado `Recebido`).

### 2️⃣ Amazon Rekognition (Biometria)
Na mesma etapa de `Em Análise`:
*   A API *Compare Faces* valida a similaridade entre a *"Foto"* de rosto (estilo passaporte) submetida pelo usuário, contra a foto contida do próprio documento *"Passaporte"*.

### 3️⃣ LLM Google Gemini (Atendimento Chatbot Contextualizado)
O Bot do YouVisa consegue entender qualificado em que parte do fluxo o cliente está.
*   **Se** Status = `Documentos Pendentes`, o bot infere (sem alucinar) quais os próximos passos do usuário na plataforma para avançar o estado.
*   O chatbot obriga login OTP dentro da própria conversa caso o usuário pergunte "Qual o status do MEU processo?".

---

