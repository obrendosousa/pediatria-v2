---
type: meta
version: "1.0"
created_at: "2026-03-21"
description: "Configuracao central do vault Obsidian — cerebro compartilhado dos agentes de IA"
---

# Vault Config

## Agentes com Acesso

| Agente | Read | Write | Folders permitidos |
|--------|------|-------|--------------------|
| Clara | Tudo | Tudo | * |
| Analyst | Tudo | Limitado | agents/analyst/, decisions/, knowledge/ |
| Copilot | Limitado | Limitado | agents/copilot/, knowledge/operations/ |

## Regras de Escrita

1. Toda nota DEVE ter frontmatter YAML com pelo menos `type` e `created_at`
2. Notas em `memories/` DEVEM ter `supabase_id` vinculando ao pgvector
3. Decisoes DEVEM ter `decided_by`, `category` e `status`
4. Wikilinks `[[nota]]` sao usados para cross-reference entre notas
5. Tags no frontmatter usam array: `tags: [tag1, tag2]`
