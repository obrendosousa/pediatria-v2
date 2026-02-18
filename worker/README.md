# LangGraph Automation Worker

Worker separado para orquestracao de automacoes com LangGraph.

## Comandos

- `npm run worker:dev`

## Endpoints

- `GET /health`

## Variaveis

- `WORKER_PORT` (padrao `4040`)
- `WORKER_POLL_INTERVAL_MS` (padrao `5000`)
- `WORKER_SCHEDULER_INTERVAL_MS` (padrao `60000`)
- `WORKER_DRY_RUN` (`true` ou `false`)
