# Operacao de Agendamentos e Automacoes

## 1) Backlog por status

```sql
select status, count(*)::int as total
from scheduled_messages
group by status
order by status;
```

## 2) Ultimos agendamentos e erros

```sql
select
  id,
  chat_id,
  status,
  scheduled_for,
  sent_at,
  retry_count,
  next_retry_at,
  dispatch_locked_by,
  dispatch_locked_at,
  last_error,
  created_at
from scheduled_messages
order by id desc
limit 30;
```

## 3) Logs recentes do worker

```sql
select
  created_at,
  run_id,
  thread_id,
  graph_name,
  node_name,
  level,
  message,
  metadata
from worker_run_logs
order by id desc
limit 50;
```

## 4) Dead-letter pendente de analise

```sql
select
  id,
  created_at,
  source_graph,
  source_node,
  scheduled_message_id,
  retry_count,
  retryable,
  error_message
from langgraph_dead_letter
where resolved_at is null
order by id desc
limit 50;
```

## 5) Duplicidade por wpp_id (sinal de risco)

```sql
select
  wpp_id,
  count(*)::int as total
from chat_messages
where wpp_id is not null
group by wpp_id
having count(*) > 1
order by total desc, wpp_id
limit 50;
```

## 6) Smoke test (2 minutos)

1. Criar um agendamento para +2 minutos.
2. Confirmar transicao de status:
   - `pending` -> `processing` -> `sent`
3. Confirmar log `message_sent` em `worker_run_logs`.
4. Confirmar que nao houve novo registro em `langgraph_dead_letter`.
