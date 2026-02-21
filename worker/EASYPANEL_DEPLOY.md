# Deploy no Easypanel (modelo definitivo)

## 1) Estrutura de servicos

Crie dois servicos no mesmo projeto:

- `clinica-web`
  - comando: `npm run start`
- `clinica-worker`
  - comando: `npm run worker:start`

> O worker deve ter restart automatico habilitado.

## 2) Variaveis de ambiente obrigatorias

Use as mesmas credenciais do app web no worker:

- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE`

Especificas do worker:

- `WORKER_DRY_RUN=false`
- `LANGGRAPH_CHECKPOINTER_MODE=auto`
- `WORKER_PORT=4040`
- `WORKER_POLL_INTERVAL_MS=5000`
- `WORKER_SCHEDULER_INTERVAL_MS=60000`
- `WORKER_DISPATCH_LOCK_TIMEOUT_SECONDS=180`
- `ENABLE_HTTP_CRON_ENDPOINTS=false`

## 3) Banco de dados

Antes de subir o worker novo, aplique:

- `database/langgraph_migration_phase1.sql`
- `database/add_sent_at_to_scheduled_messages.sql`
- `database/harden_dispatch_claim_processing.sql`

## 4) Validacao pos-deploy (5 minutos)

1. Verifique log do worker com `online at :4040`.
2. Crie um agendamento para +2 minutos.
3. Confira no banco:
   - `pending -> processing -> sent`
4. Confira no `worker_run_logs` evento `message_sent`.
5. Confira `langgraph_dead_letter` sem crescimento anormal.
