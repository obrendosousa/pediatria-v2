# LangGraph Automation Worker

Worker separado para orquestracao de automacoes com LangGraph.

## Comandos

- `npm run worker:dev`
- `npm run worker:start` (producao)

## Endpoints

- `GET /health`
  - inclui estado dos jobs de cron (`cronJobs`) e estado do checkpointer (`checkpointer`)

## Variaveis

- `WORKER_PORT` (padrao `4040`)
- `WORKER_POLL_INTERVAL_MS` (padrao `5000`)
- `WORKER_SCHEDULER_INTERVAL_MS` (padrao `60000`)
- `WORKER_DRY_RUN` (`true` ou `false`)
- `LANGGRAPH_CHECKPOINTER_MODE` (`auto`, `postgres`, `memory`; padrao `auto`)
- `WORKER_DISPATCH_LOCK_TIMEOUT_SECONDS` (padrao `180`)
- `ENABLE_HTTP_CRON_ENDPOINTS` (`false` em producao com worker dedicado)

## Comportamento de agendamento robusto

- Jobs nao executam em sobreposicao.
- Falhas aplicam backoff exponencial automaticamente.
- `/health` expone contadores de execucao/falha por job para observabilidade operacional.
- A fila usa lock com timeout e estado `processing` para evitar consumo duplicado apos restart.
- Grafos de scheduler/dispatch usam `MemorySaver` local para nao depender do Postgres de checkpoint.

## Padrao de deploy (Easypanel)

- Servico web: `npm run start`
- Servico worker dedicado: `npm run worker:start`
- Configure restart automatico no worker.
- Nao use cron HTTP externo para `/api/cron/*` quando o worker dedicado estiver ativo.
- Guia rapido: `worker/EASYPANEL_DEPLOY.md`
