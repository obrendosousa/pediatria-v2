---
type: report
titulo: 'Auditoria de Histórico de Leads Ignorados (1521, 1702, 243, 1497)'
tipo: analise_chats
supabase_id: 31
created_at: '2026-03-23T20:02:17.075Z'
agents_involved:
  - clara
tags: []
---
# 📊 Auditoria de Histórico: Leads Ignorados e Gargalos (23/03/2026)

Esta auditoria analisou quatro casos específicos identificados com falhas de interação ou abandono.

---

### 1. Lead Perdido por Demora Crítica
**Paciente:** [[chat:1702|Lead 1702]]
- **Ocorrência:** O paciente solicitou agendamento em **19/03 às 16:46**.
- **Falha:** A primeira resposta humana ocorreu apenas em **23/03 às 10:17** (4 dias de intervalo).
- **Desfecho:** O paciente recusou o agendamento: *"Não meu amor por conta da demora. Consultei com outro profissional."*
- **Status:** 🔴 **PERDA CONFIRMADA** por tempo de resposta.

### 2. Atrito por Redirecionamento de Canal
**Paciente:** [[chat:1497|Lead 1497]]
- **Ocorrência:** Paciente de 26 anos buscando orçamento de exames e preventivo.
- **Falha:** A secretária Joana forneceu informações básicas e redirecionou o paciente para um *segundo número* para fechar o agendamento/descontos.
- **Feedback do Paciente:** *"Mandei várias mensagens. Ninguém responde 🥲🥲"*.
- **Status:** ⚠️ **RISCO DE ABANDONO.** O fluxo de "pular" entre números gera fricção e percepção de descaso.

### 3. Caso de Urgência com Fechamento Vago
**Paciente:** [[chat:1521|Maria Júlia Melo]]
- **Ocorrência:** Mãe relata que a criança de 2 anos está doente (vômito e diarreia) e pede encaixe para amanhã.
- **Análise:** A secretária confirmou disponibilidade às 12:32. A mãe enviou um áudio às 16:09 (provavelmente confirmando ou tirando dúvida final). A resposta da clínica às 17:01 foi apenas um *"Tudo bem!"*.
- **Status:** 🟡 **ATENÇÃO.** Não há uma confirmação explícita de horário ou instruções de preparo no texto após o último áudio.

### 4. Contato de Fornecedor (Ignorado)
**Contato:** [[chat:243|Uemerson (Sorvetes Vilela)]]
- **Ocorrência:** Proposta de parceria enviada em 24/02.
- **Falha:** Nenhuma interação por parte da clínica em quase 30 dias.
- **Status:** ⚪ **IGNORADO.** (Baixo impacto financeiro direto, mas indica acúmulo de pendências no chat).

---

### 💡 Recomendações Imediatas:
1. **Protocolo de Resposta < 24h:** O caso 1702 demonstra que 4 dias de espera é fatal para a conversão.
2. **Unificação de Atendimento:** Evitar o redirecionamento do lead para outros números de WhatsApp. O agendamento deve ser iniciado e concluído no mesmo canal.
3. **Check-up de Urgências:** Priorizar o fechamento do caso 1521, garantindo que a mãe saiba exatamente o horário do encaixe para a criança doente.
