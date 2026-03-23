---
type: report
titulo: Auditoria de Conversão e Plano de Ação - Março 2026
tipo: analise_chats
supabase_id: 25
created_at: '2026-03-23T19:27:36.732Z'
agents_involved:
  - clara
tags: []
---
# 📊 Relatório de Auditoria e Plano de Ação (21/02 a 23/03)

Este relatório consolida a análise de **319 conversas** e **7.189 mensagens** para identificar gargalos operacionais e financeiros.

---

## 1. 🚩 Análise de Objeções e Perdas Financeiras

### **Objeção nº 1: Falta de Vaga Imediata (Urgência)**
*   **Frequência:** Alta (10 perdas confirmadas no mês).
*   **Impacto:** **- R$ 5.000,00** em faturamento direto.
*   **Evidência:** 
    *   [[chat:1638|Deus é Fiel 🙏]]: *"Não tem como abrir uma excessão pra hoje? A minha bebe ta com 3 dias dando febre"*.
    *   [[chat:1669|Leudimar Sousa Rocha]]: *"vou procura em outro outro lugar"* (após implorar por encaixe).
*   **Conclusão:** A clínica expulsa pacientes de "alta intenção" (febre/dor) que pagariam R$ 500 à vista por falta de slots de respiro.

### **Objeção nº 2: Reajuste de Preço (R$ 350 -> R$ 500)**
*   **Frequência:** Alta (29 ocorrências).
*   **Impacto:** Desistências imediatas quando o valor é enviado sem ancoragem.
*   **Evidência:** 
    *   [[chat:214|Pathy Mello]]: *"Vishe, tudo isso? Consultei mês passado... e só foi 350,00"*.
    *   [[chat:1732|✨]]: Questionou o salto de valor e pediu desconto antes de agendar.
*   **Conclusão:** O público é fiel, mas o "choque" do reajuste precisa de um script de valorização prévia.

---

## 2. ⚠️ Falhas Operacionais e "Agenda Fantasma"

### **O Gargalo do Funil (CRM)**
*   **Status:** Crítico.
*   **Evidência:** Em 23/03, **100% dos chats** com intervenção humana (29 atendimentos) constavam como `new`, mesmo os agendados.
*   **Exemplo:** [[chat:1727|Vinícius Marques]] agendou para o dia seguinte, mas o card não foi movido.
*   **Impacto:** Impossibilidade de gerar métricas de conversão reais e falha nos lembretes automáticos.

### **Erros de Agendamento e Triagem**
*   **Caso Crítico:** [[chat:1735|.]] solicitou tarde, forneceu dados, mas a secretária confirmou de manhã. O paciente precisou corrigir: *"Eu perguntei se podia ser de tarde"*.
*   **Abandono de Urgência:** [[chat:1521| Mariana Melo]] relatou bebê com vômito/diarreia, mandou áudio e ficou sem resposta final no fechamento.

---

## 3. 💡 Plano de Ação e Melhorias

### **Ação 1: Implementar "Vagas de Pulmão"**
*   **O que fazer:** Reservar 2 slots diários (ex: 11:30 e 16:30) exclusivos para intercorrências agudas (febre/dor).
*   **Ganho estimado:** + R$ 5.000,00/mês.

### **Ação 2: Script de Ancoragem de Valor**
*   **O que fazer:** Enviar os diferenciais (Guia de Marcos, Farmacinha, Acolhimento) ANTES do preço de R$ 500.
*   **Objetivo:** Reduzir o atrito do reajuste.

### **Ação 3: Protocolo de "Aviso de Vez"**
*   **O que fazer:** Para pacientes do interior (Lagoa Grande, Paulo Ramos), oferecer o aviso via WhatsApp quando faltarem 2 pessoas na fila.
*   **Objetivo:** Reduzir a ansiedade e desistências por logística.

### **Ação 4: Higiene do CRM**
*   **O que fazer:** Treinamento da equipe: "Dados recebidos + Pix = Mover para Agendado". Auditoria diária às 18h.

---
*Relatório gerado pela Clara em 23/03/2026 com base em dados determinísticos do banco de dados.*
