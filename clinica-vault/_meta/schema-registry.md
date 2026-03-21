---
type: meta
version: "1.0"
---

# Schema Registry — Frontmatter YAML

## memory
```yaml
type: memory
memory_type: string         # preferencia_paciente | processo | regra | fato | observacao
source_role: string         # admin | doctor | system | copilot | analyst
created_at: ISO8601
updated_at: ISO8601
supabase_id: number         # FK para clara_memories.id
tags: string[]
confidence: number          # 0.0 - 1.0
agent_source: string        # clara | analyst | copilot
```

## report
```yaml
type: report
titulo: string
tipo: string                # analise_chats | financeiro | agendamento | geral
created_at: ISO8601
period_start: YYYY-MM-DD
period_end: YYYY-MM-DD
supabase_id: number         # FK para clara_reports.id
agents_involved: string[]
tags: string[]
```

## decision
```yaml
type: decision
decision_date: YYYY-MM-DD
decided_by: string          # admin | doctor | clara | analyst
category: string            # operacional | clinico | financeiro | tecnico
status: string              # active | superseded | revoked
supersedes: string|null     # Link para decisao anterior
related_chats: number[]
tags: string[]
```

## daily
```yaml
type: daily
date: YYYY-MM-DD
auto_generated: boolean
metrics_snapshot:
  total_chats: number
  new_chats: number
  messages: number
agent_activity:
  clara_interactions: number
  copilot_triggers: number
  analyst_queries: number
```

## knowledge
```yaml
type: knowledge
category: string            # clinical | operations | technical
subcategory: string
last_consolidated: YYYY-MM-DD
source_memories: number[]   # IDs das memorias que alimentaram
version: number
tags: string[]
```

## chat_note
```yaml
type: chat_note
chat_id: number
contact_name: string
phone: string
last_updated: ISO8601
supabase_synced: boolean
tags: string[]
```

## agent_config
```yaml
type: agent_config
agent_id: string            # clara | analyst | copilot
config_key: string          # company | rules | voice_rules
updated_at: ISO8601
```
