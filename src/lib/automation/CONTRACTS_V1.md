# Contratos de Automacao (v1)

Este arquivo descreve o baseline dos contratos usados no cutover big-bang para o worker LangGraph.

## Entradas normalizadas

- `SendCommandContract`: comando de envio (API send, funil, scheduler).
- `WebhookEventContract`: evento bruto do webhook para processamento no worker.
- `SchedulerRunCommandContract`: comando para gerar agendamentos.
- `DispatchRunCommandContract`: comando para despachar pendentes da fila.
- `FunnelRunCommandContract`: comando para executar passos de macro/funil no servidor.

## Campos de correlacao

- `contractVersion`: permite evolucao sem quebrar consumidores.
- `runId`: correlacao da execucao ponta-a-ponta.
- `threadId`: correlacao de estado no LangGraph (thread/checkpoint).

## Saida padrao

- `WorkerAckContract`: resposta unificada com `ok`, `runId`, `threadId` e payload de erro estruturado.
