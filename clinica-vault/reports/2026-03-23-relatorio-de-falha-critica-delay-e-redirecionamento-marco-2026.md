---
type: report
titulo: 'Relatório de Falha Crítica: Delay e Redirecionamento (Março 2026)'
tipo: analise_chats
supabase_id: 33
created_at: '2026-03-23T20:26:36.501Z'
agents_involved:
  - clara
tags: []
---
# 🚨 Relatório de Falha Crítica: Delay e Redirecionamento (Março 2026)

Este relatório detalha a quebra de confiança identificada no fluxo de atendimento, caracterizada por silêncios prolongados em dúvidas clínicas e redirecionamentos sem contexto.

## 1. Análise de Casos Críticos (Amostra Auditada)

| Chat ID | Paciente | Problema Identificado | Desfecho |
| :--- | :--- | :--- | :--- |
| [[chat:1576|Larissa🦋]] | Miguel de Sousa Cabral | **4 dias de silêncio** após dúvida sobre dentição/medicação. | **Perda de Confiança:** "Aguardei a resposta e nada... Pensei que tiraria dúvidas pelo celular." |
| [[chat:1702|Yara]] | Yara | **4 dias de delay** na resposta inicial. | **Abandono:** "Não meu amor por conta da demora Consultei com outro profissional." |
| [[chat:1705|Rosana Alves 🌹]] | Rosana Alves | **3 dias de hiato** em dúvida clínica/agendamento. | **Abandono:** "Desculpa, mas já realizei a consulta [em outro lugar]." |
| [[chat:1488|Dayanne Chaves]] | Dayanne Chaves | **40 horas de espera** para saber sobre objeto esquecido. | **Frustração:** Conversa não prosseguiu após a resposta tardia. |
| [[chat:1552|Perfeito Só Deus ❤️]] | - | **Redirecionamento seco:** "Verifique com esse contato" após envio de exames. | **Quebra de Fluxo:** Paciente precisa reiniciar o atendimento em outro canal. |
| [[chat:1562|Maria]] | Maria | **Redirecionamento sem contexto:** "Entre em contato com esse número" após áudios. | **Barreira de Entrada:** A secretária não ouviu/resumiu o áudio antes de redirecionar. |

## 2. Padrões de Falha Identificados

### A. O "Buraco Negro" Clínico
Dúvidas sobre sintomas (febre, dentição, vômito) que não são respondidas imediatamente pela secretária (que depende da médica) acabam esquecidas. O paciente interpreta o silêncio como descaso, especialmente em casos de urgência pediátrica.

### B. Redirecionamento "Preguiçoso"
Foram detectados **119 casos** de mensagens da secretária contendo "número" ou "contato" desde 01/03. Em muitos casos (ex: 1552, 1562), o redirecionamento ocorre sem que a secretária tente entender a demanda ou explicar por que o contato deve ser feito em outro número.

### C. Resposta "Bot-Like" Pós-Crise
Em casos como o 1576, após o paciente expressar profunda frustração, a secretária responde com um template genérico de boas-vindas ("Olá! Me chamo Joana..."), o que aumenta a percepção de atendimento impessoal e automatizado.

## 3. Impacto no Funil
*   **Taxa de Abandono por Delay:** Estimada em ~15% dos leads que iniciam triagem mas não agendam.
*   **Sentimento Negativo:** Concentrado em reclamações de "demora no retorno" e "falta de atenção".

## 4. Recomendações Imediatas
1.  **Protocolo de Resposta Clínica:** Se a médica não responder em 2h, a secretária deve enviar um "Ainda não consegui falar com a Dra, mas não esqueci de você. Assim que ela liberar a conduta, te aviso."
2.  **Fim do Redirecionamento Seco:** Proibir o envio de números externos sem um resumo prévio ("Entendi que você precisa de X, para isso o setor responsável é Y no número Z").
3.  **Humanização Pós-Reclamação:** Bloquear o uso de templates de saudação quando o histórico já contém mensagens de insatisfação.

---
*Relatório gerado em 23/03/2026 pelo Agente de Dados Clara.*
