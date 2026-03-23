---
type: report
titulo: Relatório de Revenue Leakage - Março 2026
tipo: financeiro
supabase_id: 36
created_at: '2026-03-23T20:48:17.259Z'
agents_involved:
  - clara
tags: []
---
# Relatório de Revenue Leakage (16/03/2026 - 23/03/2026)

## Resumo Executivo
O cálculo de *Revenue Leakage* foi realizado com base na identificação de gargalos operacionais relacionados a urgências não atendidas ou mal geridas.

*   **Período:** 16/03/2026 a 23/03/2026
*   **Volume de chats com "urgência não atendida":** 3
*   **Ticket Médio Estimado:** R$ 400,00
*   **Revenue Leakage Estimado:** **R$ 1.200,00**

## Detalhamento dos Gargalos
Foram identificados 3 chats no período que apresentaram falhas críticas no atendimento de urgências:
1.  Falta de empatia com urgência e comunicação truncada.
2.  Falta de empatia, demora na resolução de urgência e não priorização de sintomas graves.
3.  Indisponibilidade de agenda e falta de proatividade em casos urgentes.

## Metodologia
A contagem foi realizada através da análise da tabela `chat_insights`, filtrando por tags de gargalos específicas relacionadas a urgências (`falta_de_empatia_com_urgencia`, `nao_priorizou_sintomas_graves`, `demora_na_resolucao_de_urgencia`, `falta_de_proatividade_em_casos_urgentes`). O valor foi obtido multiplicando o volume de ocorrências pelo ticket médio de R$ 400,00.
