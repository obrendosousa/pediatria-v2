# Go-live Big-Bang Checklist

## T-7 a T-1

- Aplicar `database/langgraph_migration_phase1.sql` em homologacao e producao.
- Validar variaveis:
  - `LANGGRAPH_CHECKPOINT_POSTGRES_URI` (ou `DATABASE_URL`)
  - `LANGGRAPH_CHECKPOINTER_MODE` (`auto` recomendado; usar `postgres` apenas se quiser falhar sem fallback)
  - `WORKER_DISPATCH_LOCK_TIMEOUT_SECONDS` (`180` recomendado)
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`
  - `WORKER_PORT`, `WORKER_POLL_INTERVAL_MS`, `WORKER_SCHEDULER_INTERVAL_MS`
- Subir worker com `npm run worker:dev` em homologacao e `npm run worker:start` em producao.
- Rodar dry-run: `npm run worker:dry-run`.
- Validar endpoint `GET /health`.
- Validar SLO baseline: `GET /api/automation/metrics/slo`.

## T0 (janela de corte)

- Deploy unico com:
  - Servico web (`npm run start`) e servico worker dedicado (`npm run worker:start`) ativos.
  - Frontend usando `/api/automation/funnel/run` para macro/funil.
  - Webhook com ingestao persistida (`thread_id` + checkpointer).
- Confirmar `ENABLE_HTTP_CRON_ENDPOINTS=false` em producao para evitar duplicidade de consumo.
- Confirmar processamento de ponta-a-ponta com 1 mensagem real de teste.

## T+1h a T+72h

- Monitorar `worker_run_logs` por `run_id` e `thread_id`.
- Monitorar `langgraph_dead_letter` (crescimento anormal).
- Monitorar `GET /health`:
  - `cronJobs[].consecutiveFailures`
  - `cronJobs[].lastError`
  - `checkpointer.mode` (`postgres` ou `memory`; `memory` indica fallback ativo)
- Validar SLO:
  - taxa de sucesso >= 95%
  - dead-letter dentro do limite operacional

## Rollback operacional

- Gatihos:
  - backlog crescendo continuamente por 15 min
  - falha de envio acima do SLO
  - duplicacao detectada em mensagens (`wpp_id` repetido em massa)
- Passos:
  1. Reverter deploy app/worker para a versao anterior.
  2. Pausar consumo de novos jobs no worker.
  3. Reprocessar pendencias com dedupe por `run_id` e `wpp_id`.
  4. Registrar incidente e evidencia no `worker_run_logs`.
