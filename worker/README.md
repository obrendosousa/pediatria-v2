# LangGraph Automation Worker

Worker separado para orquestracao de automacoes com LangGraph.

## Comandos

- `npm run worker:dev`

## Endpoints

- `GET /health`
  - inclui estado dos jobs de cron (`cronJobs`) e estado do checkpointer (`checkpointer`)

## Variaveis

- `WORKER_PORT` (padrao `4040`)
- `WORKER_POLL_INTERVAL_MS` (padrao `5000`)
- `WORKER_SCHEDULER_INTERVAL_MS` (padrao `60000`)
- `WORKER_DRY_RUN` (`true` ou `false`)
- `LANGGRAPH_CHECKPOINTER_MODE` (`auto`, `postgres`, `memory`; padrao `auto`)

## Comportamento de agendamento robusto

- Jobs nao executam em sobreposicao.
- Falhas aplicam backoff exponencial automaticamente.
- `/health` expone contadores de execucao/falha por job para observabilidade operacional.
