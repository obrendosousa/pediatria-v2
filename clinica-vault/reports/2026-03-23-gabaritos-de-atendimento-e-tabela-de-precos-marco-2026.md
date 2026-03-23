---
type: report
titulo: Gabaritos de Atendimento e Tabela de Preços - Março 2026
tipo: geral
supabase_id: 20
created_at: '2026-03-23T16:49:50.383Z'
agents_involved:
  - clara
tags: []
---
# Extração de Gabaritos e Conhecimento Tácito
**Data da Extração:** 2026-03-23
**Fontes:** Chats 1725, 1727, 1722, 1521, 1721

## 1. Script: Agendamento por Ordem de Chegada
Utilizado para alinhar expectativas após a confirmação da data.
- **Texto Exato:** "Os atendimentos são por ordem de chegada"
- **Contexto:** Enviado imediatamente após a confirmação do agendamento e do horário de início (ex: "a partir das 9:00hrs da manhã").
- **Exemplos:** [[chat:1725|Elouise Mota]], [[chat:1727|Benicio Vieira]].

## 2. Script: Justificativa de Reajuste de Preço (R$ 500)
Utilizado quando o paciente questiona o valor comparado a atendimentos anteriores.
- **Texto Exato:** "Isso, tivemos um reajuste no valor da consulta"
- **Contexto:** Resposta direta e simplificada à observação do paciente sobre o aumento.
- **Exemplo:** [[chat:1727|Benicio Vieira]] (Paciente mencionou consulta no ano passado).

## 3. Tabela de Valores: Teste do Pezinho
Valores praticados no Centro Médico Aliança Kids.
- **Teste do Pezinho Master:** R$ 260,00
- **Teste do Pezinho Plus:** R$ 120,00
- **Teste do Pezinho Básico:** R$ 115,00
- **Observação:** Descontos disponíveis para pagamento em espécie.
- **Exemplo:** [[chat:1722|Paciente anônimo]].

## 4. Script: Triagem de Urgência Clínica
Fluxo de resposta para sintomas agudos (vômito/diarreia).
- **Passo 1 (Acolhimento):** "Olá, bom dia. Tudo bem?"
- **Passo 2 (Identificação):** "Qual seria a idade da paciente, por gentileza?"
- **Passo 3 (Disponibilidade):** "Temos disponibilidade para amanhã pela manhã. Deseja agendar?"
- **Exemplo:** [[chat:1521|Maria Júlia Melo]].

## 5. Dados Adicionais de Faturamento/Agenda
- **Consulta Dra. Fernanda Santana:** R$ 500,00
- **Consulta Dra. Fabíola:** R$ 400,00
- **Dias de Atendimento (Geral):** Terça, Quarta e Sexta-feira.
- **Horário de Confirmação:** Mensagens de confirmação enviadas até as 15:00h do dia anterior.
