# Plano de Implementação — Gestão de Tarefas & Chat Interno

> **Data:** 2026-04-09
> **Depende de:** `PRD_GESTAO_TAREFAS_FRONTEND.md` + `PRD_GESTAO_TAREFAS_BACKEND.md` (com errata §11)
> **Estratégia:** Bottom-up — banco → tipos → API → hooks → componentes → telas

---

## Visão Geral das Fases

| Fase | Escopo | Entregável | Critério de "Pronto" |
|------|--------|-----------|---------------------|
| **1** | Infraestrutura & Backend Core | Schema + tipos + API CRUD + seed | Kanban renderiza dados reais do banco |
| **2** | Frontend Core & Chat | Kanban DnD + Chat full + Realtime | Usuário cria tarefa, arrasta, conversa, recebe em tempo real |
| **3** | Inteligência & Polish | Dashboard + Clara + Notificações + ⌘K | Sistema completo, responsivo, com IA integrada |

---

## FASE 1 — Infraestrutura & Backend Core

> **Objetivo:** Banco de dados 100% funcional, tipos TypeScript, API CRUD completa, dados seed.
> Zero frontend novo nesta fase — apenas arquivos de infra.

### 1.1 Schema SQL Completo

**Arquivo:** `database/gestao_schema.sql`

**Ordem de execução (respeitando FKs):**

```
1. CREATE SCHEMA gestao
2. GRANT USAGE (sem anon — ver errata §11.4.1)
3. CREATE TABLE gestao.boards
4. CREATE TABLE gestao.board_members
5. CREATE TABLE gestao.columns
6. CREATE TABLE gestao.tasks
7. CREATE TABLE gestao.labels
8. CREATE TABLE gestao.task_labels
9. CREATE TABLE gestao.checklist_items
10. CREATE TABLE gestao.task_comments
11. CREATE TABLE gestao.task_activity_log (com REVOKE UPDATE/DELETE — errata §11.4.2)
12. CREATE TABLE gestao.message_task_links
13. CREATE TABLE gestao.clara_queue (com RLS — errata §11.4.3)
14. CREATE TABLE gestao.notifications
15. CREATE TABLE gestao.user_preferences
16. ALTER TABLE public.internal_conversations (add type, name, avatar_url, description, created_by, include_clara, is_pinned_by, is_archived_by)
17. ALTER TABLE public.internal_conversation_participants (add role, is_muted, last_read_at)
18. ALTER TABLE public.internal_messages (add reply_to_id, mentions, is_pinned, edited_at, is_deleted, metadata)
19. CREATE TABLE public.message_reactions
20. Indexes (todos, incluindo pg_trgm — errata §11.5.2, §11.5.3)
21. Views (vw_tasks_enriched com CTEs — errata §11.5.1, vw_dashboard_metrics, vw_user_workload)
22. Triggers (set_updated_at, log_task_changes corrigido — errata §11.1.3, notify_task_assigned, detect_clara_mention corrigido — errata §11.1.2, notify_task_completed — errata §11.3.1, notify_chat_mention — errata §11.3.3)
23. RLS Policies (todas, com columns granulares — errata §11.1.4, activity_log INSERT — errata §11.1.5)
24. Imutabilidade do activity_log (trigger prevent_mutation — errata §11.4.2)
25. ALTER PUBLICATION supabase_realtime ADD TABLE (com fallback — errata §11.6)
```

**Checklist de validação:**
- [ ] Todas as 17 tabelas do schema `gestao` criadas
- [ ] 4 ALTER TABLE nas tabelas `internal_*` existentes
- [ ] 1 tabela nova em `public` (message_reactions)
- [ ] pg_trgm extension habilitada
- [ ] Sem GRANT para `anon`
- [ ] `task_activity_log` com REVOKE UPDATE/DELETE + trigger de proteção
- [ ] `clara_queue` com RLS (service_role only)
- [ ] UUID reservado da Clara: `00000000-0000-0000-0000-00000000c1a4`
- [ ] Publicação Realtime verificada

### 1.2 Seed do Board Padrão

**Arquivo:** `database/gestao_seed.sql`

- Função `gestao.seed_default_board()` com guarda idempotente (errata §11.1.6)
- Board "Geral" com colunas: Backlog, Fazendo, Revisão, Feito
- 8 labels default
- Todos os `profiles.status = 'approved'` adicionados como membros
- Criar profile da Clara com UUID reservado

### 1.3 Tipos TypeScript

**Arquivo:** `src/types/gestao.ts`

```
Tipos a definir (em ordem de dependência):

Enums:
- TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none'
- BoardVisibility = 'private' | 'team' | 'public'
- BoardMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
- NotificationType = 'task_assigned' | 'task_completed' | 'task_due_soon' | 'task_overdue' | 'chat_mention' | 'chat_message' | 'clara_action'
- ConversationType = 'direct' | 'group'
- UserStatus = 'online' | 'offline' | 'away' | 'busy'

Interfaces principais:
- GestaoBoard, BoardMember
- GestaoColumn
- GestaoTask (campos base) + GestaoTaskEnriched (com joins da view)
- GestaoLabel, TaskLabel
- ChecklistItem
- TaskComment
- TaskActivityLog
- MessageReaction
- GestaoChatGroup, GestaoChatMember
- GestaoNotification
- GestaoPreferences
- DashboardKPIs, DashboardChartData, DashboardWorkload, DashboardRanking, DashboardOverdueTask

Params (para API):
- TaskListParams (errata §11.2 — com filtros, paginação, sort)
- CreateTaskParams, UpdateTaskParams
- CreateBoardParams, UpdateBoardParams
- CreateCommentParams
- BulkActionParams
```

### 1.4 Helpers de Infraestrutura

**3 arquivos:**

| Arquivo | Conteúdo |
|---------|----------|
| `src/lib/gestao-auth.ts` | `getGestaoClient()` (retorna `supabase.schema('gestao')` — errata §11.1.1), `getBoardMembership()`, `requireBoardAccess()`, `createGestaoNotification()` |
| `src/lib/gestao-validators.ts` | Zod schemas para TODOS os endpoints (errata §11.4.5) — `createTaskSchema`, `updateTaskSchema`, `messageSchema`, `reactionSchema`, `commentSchema`, `createBoardSchema`, `createGroupSchema`, `bulkActionSchema`, `preferencesSchema` |
| `src/lib/gestao-realtime.ts` | Helpers de broadcast: `broadcastTyping()`, `broadcastClaraStatus()`, `broadcastTaskMove()` |

### 1.5 API Routes — CRUD Core (26 endpoints)

**Ordem de implementação (por dependência):**

```
Bloco A — Boards & Colunas (8 endpoints):
  1. GET    /api/gestao/boards              — listar boards do usuário
  2. POST   /api/gestao/boards              — criar board
  3. PATCH  /api/gestao/boards/[id]         — atualizar board
  4. DELETE /api/gestao/boards/[id]         — deletar board
  5. GET    /api/gestao/boards/[id]/columns — listar colunas
  6. POST   /api/gestao/boards/[id]/columns — criar coluna
  7. PATCH  /api/gestao/columns/[id]        — atualizar coluna
  8. DELETE /api/gestao/columns/[id]        — deletar coluna (+ validar que não tem tasks)

Bloco B — Tasks CRUD (12 endpoints):
  9.  GET    /api/gestao/tasks               — listar com filtros/paginação/sort
  10. POST   /api/gestao/tasks               — criar tarefa
  11. GET    /api/gestao/tasks/[id]          — detalhe completo
  12. PATCH  /api/gestao/tasks/[id]          — atualizar campos
  13. DELETE /api/gestao/tasks/[id]          — deletar tarefa
  14. PATCH  /api/gestao/tasks/[id]/move     — mover entre colunas
  15. PATCH  /api/gestao/tasks/reorder       — reordenar na coluna (com transação)
  16. PATCH  /api/gestao/columns/reorder     — reordenar colunas
  17. POST   /api/gestao/tasks/[id]/duplicate — duplicar (errata §11.2)
  18. PATCH  /api/gestao/tasks/[id]/archive  — toggle arquivar (errata §11.2)
  19. POST   /api/gestao/tasks/bulk          — ações em lote
  20. GET    /api/gestao/labels              — listar labels (com filtro board_id)

Bloco C — Sub-recursos de Task (6 endpoints):
  21. GET    /api/gestao/tasks/[id]/comments  — listar comentários (paginado)
  22. POST   /api/gestao/tasks/[id]/comments  — adicionar comentário
  23. DELETE /api/gestao/comments/[id]        — deletar comentário
  24. POST   /api/gestao/tasks/[id]/checklist — adicionar item
  25. PATCH  /api/gestao/checklist/[id]       — toggle/editar item
  26. DELETE /api/gestao/checklist/[id]       — deletar item
```

**Padrão de cada route.ts:**
```typescript
import { requireAuth } from '@/lib/api-auth'
import { getGestaoClient, requireBoardAccess } from '@/lib/gestao-auth'
import { createTaskSchema } from '@/lib/gestao-validators'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const { user, supabase } = auth
    const gestao = getGestaoClient(supabase)

    const body = await req.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // ... lógica
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

### 1.6 API Routes — Labels & Preferences (4 endpoints)

```
27. POST   /api/gestao/labels                    — criar label
28. POST   /api/gestao/tasks/[id]/labels         — atribuir label
29. DELETE /api/gestao/tasks/[id]/labels/[labelId] — remover label
30. GET+PATCH /api/gestao/preferences             — ler/atualizar preferências
```

### 1.7 Migration Script

**Arquivo:** `scripts/migrate-tasks-to-gestao.ts`

```
1. Ler todas as tasks de atendimento.tasks
2. Para cada task, inserir em gestao.tasks com legacy_task_id = id original
3. Mapear type='general' para coluna "Backlog", type='sticky_note' para coluna "Fazendo"
4. Preservar checklist (metadata.checklist → gestao.checklist_items)
5. Log de migração (quantas migradas, quantas com erro)
6. NÃO deletar dados originais
```

### Entregável Fase 1

Ao final da Fase 1, rodar no terminal:
```bash
# 1. Executar SQL no Supabase SQL Editor (gestao_schema.sql + gestao_seed.sql)
# 2. Executar migration
npx tsx --env-file=.env.local scripts/migrate-tasks-to-gestao.ts
# 3. Verificar via API
curl localhost:3000/api/gestao/boards  # → retorna board "Geral"
curl localhost:3000/api/gestao/tasks?board_id=XXX  # → retorna tarefas migradas
```

---

## FASE 2 — Frontend Core & Chat

> **Objetivo:** Telas funcionais com Kanban DnD, Chat completo, e Realtime.
> Nesta fase: componentes, hooks, telas, realtime. Sem Clara IA, sem dashboard, sem ⌘K.

### 2.1 Dependências NPM

```bash
npm install cmdk sonner vaul frimousse class-variance-authority
```

(`@ark-ui/react` removido — usar Progress do próprio Tailwind para simplificar)

### 2.2 Layout & Navegação

**Arquivos:**
```
src/app/gestao/layout.tsx             — layout com GestaoSidebar
src/components/gestao/layout/
  ├── GestaoSidebar.tsx               — sidebar colapsável (260px / 64px)
  ├── GestaoToolbar.tsx               — toolbar com filtros, busca, view tabs
  └── ViewTabs.tsx                    — tabs pill: Kanban | Lista | Calendário
```

**Ordem:**
1. `layout.tsx` — wrapper com sidebar + área de conteúdo + provider
2. `GestaoSidebar.tsx` — seções: TAREFAS (Kanban/Lista/Cal), EQUIPE (Chat/Dashboard), PROJETOS (boards dinâmicos), footer (Config/Perfil/Recolher)
3. `ViewTabs.tsx` — tabs pill para alternar view mantendo filtros
4. `GestaoToolbar.tsx` — barra de filtros + botão "+ Nova Tarefa" + busca

**Dependência:** Componente `Sidebar` do 21st.dev como base.

### 2.3 Hook `useGestaoBoard`

**Arquivo:** `src/hooks/useGestaoBoard.ts`

```
Estado:
- board: GestaoBoard | null
- columns: GestaoColumn[]
- tasks: Map<string, GestaoTaskEnriched[]>  // column_id → tasks
- loading, error

Realtime:
- Canal: gestao:board:{boardId}
- postgres_changes em gestao.tasks (INSERT/UPDATE/DELETE)
- postgres_changes em gestao.columns (INSERT/UPDATE/DELETE)
- Fallback broadcast se postgres_changes não funcionar (errata §11.6)

Mutations (otimistas com rollback):
- addColumn(name, color)
- moveTask(taskId, fromColumnId, toColumnId, newPosition)
- reorderColumns(columnIds[])
- updateTask(taskId, partial)
- deleteTask(taskId)

Cleanup:
- useEffect return → supabase.removeChannel(channel)
```

### 2.4 Kanban Board

**Arquivos (em ordem):**
```
src/components/gestao/kanban/
  ├── KanbanBoard.tsx          — DndContext + SortableContext por coluna
  ├── KanbanColumn.tsx         — Droppable container + header + lista de cards
  ├── KanbanColumnHeader.tsx   — título editável inline + menu ⋯ + counter
  ├── KanbanCard.tsx           — card arrastável com prioridade, labels, assignee, due_date
  └── KanbanDragOverlay.tsx    — ghost card durante drag
```

**Ordem de implementação:**
1. `KanbanCard.tsx` — componente puro, sem DnD (renderiza GestaoTaskEnriched)
2. `KanbanColumnHeader.tsx` — header com título, counter, dropdown menu
3. `KanbanColumn.tsx` — SortableContext vertical + lista de KanbanCards + botão "+ Adicionar"
4. `KanbanBoard.tsx` — DndContext horizontal + colunas + handlers onDragEnd/onDragOver
5. `KanbanDragOverlay.tsx` — createPortal com DragOverlay do @dnd-kit

**Regras DnD:**
- `useSensor(PointerSensor, { activationConstraint: { distance: 8 } })` — evita clique acidental
- `onDragEnd`: chama `moveTask()` do hook (otimista) + `PATCH /api/gestao/tasks/[id]/move`
- `onDragOver`: permite mover entre colunas mostrando placeholder
- Animação: `framer-motion` layoutId no card

### 2.5 Componentes Compartilhados

**Arquivos:**
```
src/components/gestao/shared/
  ├── UserAvatar.tsx           — avatar + status dot (online/offline/away)
  ├── AvatarGroup.tsx          — avatares empilhados com tooltip
  ├── PriorityBadge.tsx        — dot colorido + label (urgent→red, high→orange, etc.)
  ├── LabelTag.tsx             — badge colorida removível
  ├── EmptyState.tsx           — ilustração + texto + CTA
  └── SkeletonLoaders.tsx      — variantes: SkeletonCard, SkeletonList, SkeletonChat
```

**Ordem:** UserAvatar → PriorityBadge → LabelTag → AvatarGroup → EmptyState → SkeletonLoaders

### 2.6 Modais de Tarefas

**Arquivos:**
```
src/components/gestao/modals/
  ├── CreateTaskModal.tsx       — form completo (título, desc, status, prioridade, assignee, prazo, labels, checklist)
  ├── TaskDetailModal.tsx       — detalhe com tabs (Comentários | Log de Atividade)
  └── responsive-modal.tsx     — wrapper: Dialog no desktop, Drawer (vaul) no mobile
```

**Ordem:**
1. `responsive-modal.tsx` — base reutilizável
2. `CreateTaskModal.tsx` — form com react-hook-form + zod + campos do PRD Frontend §8.1
3. `TaskDetailModal.tsx` — campos editáveis inline + checklist interativo + comentários

### 2.7 Page Kanban

**Arquivo:** `src/app/gestao/page.tsx`

```
Composição:
<GestaoToolbar filters={filters} onFilterChange={setFilters} />
<KanbanBoard boardId={selectedBoardId} filters={filters} />
<CreateTaskModal open={showCreate} onClose={...} boardId={selectedBoardId} />
<TaskDetailModal open={!!selectedTaskId} taskId={selectedTaskId} onClose={...} />
```

### 2.8 View de Lista

**Arquivos:**
```
src/app/gestao/lista/page.tsx
src/components/gestao/list/
  ├── TaskTable.tsx             — tabela com headers sortáveis
  ├── TaskTableRow.tsx          — row com checkbox, inline edits
  └── BulkActions.tsx           — barra flutuante de ações em lote
```

**Funcionalidades:**
- Checkbox multi-select → BulkActions aparece
- Headers clicáveis para sort (ASC/DESC)
- Paginação (cursor-based)
- Mesmo dropdown ⋯ do KanbanCard

### 2.9 View de Calendário

**Arquivos:**
```
src/app/gestao/calendario/page.tsx
src/components/gestao/calendar/
  ├── TaskCalendar.tsx          — grid mensal com react-aria-components
  └── CalendarDayPopover.tsx    — popover ao clicar no dia (lista de tarefas)
```

### 2.10 API Routes — Chat (18 endpoints)

```
Bloco D — Grupos (4 endpoints):
  31. POST   /api/gestao/chat/groups             — criar grupo
  32. PATCH  /api/gestao/chat/groups/[id]        — atualizar grupo
  33. POST   /api/gestao/chat/groups/[id]/members — adicionar membro
  34. DELETE /api/gestao/chat/groups/[id]/members/[userId] — remover membro

Bloco E — Mensagens & Reações (4 endpoints):
  35. POST   /api/gestao/chat/messages/[id]/reactions — toggle reação
  36. POST   /api/gestao/chat/messages/[id]/task     — converter msg→tarefa
  37. PATCH  /api/gestao/chat/messages/[id]/pin      — toggle fixar
  38. DELETE /api/gestao/chat/messages/[id]           — soft-delete

Bloco F — Conversas (8 endpoints — errata §11.2):
  39. POST   /api/gestao/chat/conversations              — criar conversa direta
  40. PATCH  /api/gestao/chat/conversations/[id]/read    — marcar como lida
  41. PATCH  /api/gestao/chat/conversations/[id]/pin     — fixar conversa
  42. PATCH  /api/gestao/chat/conversations/[id]/mute    — toggle silenciar
  43. PATCH  /api/gestao/chat/conversations/[id]/archive — arquivar
  44. DELETE /api/gestao/chat/conversations/[id]/leave   — sair do grupo
  45. GET    /api/gestao/chat/conversations/[id]/search  — buscar mensagens
  46. GET    /api/gestao/chat/conversations/[id]/pinned  — listar fixadas

Bloco G — Extras (2 endpoints):
  47. GET    /api/gestao/chat/conversations/[id]/tasks   — tarefas vinculadas
  48. GET    /api/gestao/chat/conversations/[id]/media   — mídia compartilhada
```

### 2.11 Hooks de Chat

**Arquivos:**
```
src/hooks/useGestaoChat.ts        — mensagens, reações, pin, convertToTask
src/hooks/useGestaoPresence.ts    — presença online (track/untrack)
```

**useGestaoChat:**
```
Estado:
- messages: GestaoMessage[]
- reactions: Map<messageId, MessageReaction[]>
- hasMore: boolean
- loading: boolean

Realtime:
- Canal: gestao:chat:{conversationId}
- postgres_changes em internal_messages (INSERT)
- postgres_changes em message_reactions (INSERT/DELETE)
- broadcast: typing, clara_action_buttons

Mutations (otimistas):
- sendMessage(content, replyToId?, mentions?)
- toggleReaction(messageId, emoji)
- togglePin(messageId)
- deleteMessage(messageId)
- convertToTask(messageId, boardId, columnId)
- loadMore() — cursor-based pagination (older messages)
```

**useGestaoPresence:**
```
Estado:
- onlineUsers: Map<userId, { name, photo, status, activeConversation, onlineAt }>

Realtime:
- Canal: gestao:chat:presence (presence track/untrack)
- visibilitychange listener → status 'away' após 5min

Actions:
- setMyStatus(status)
- setActiveConversation(conversationId | null)
```

### 2.12 Componentes de Chat

**Arquivos (em ordem de implementação):**
```
src/components/gestao/chat/
  01. TypingIndicator.tsx      — 3 dots animados (framer-motion)
  02. EmojiReactions.tsx       — lista de reações + botão adicionar (frimousse)
  03. MessageBubble.tsx        — bolha com avatar, nome, hora, status, menu hover
  04. MentionAutocomplete.tsx  — dropdown de @menções (membros + Clara)
  05. ChatInput.tsx            — textarea auto-resize + emoji + anexo + menção + enviar
  06. ThreadPanel.tsx          — painel lateral de thread (mensagem original + respostas)
  07. GroupInfoPanel.tsx       — painel info: membros, mídia, tarefas, ações
  08. ConversationItem.tsx     — item na lista (avatar, nome, preview, hora, unread)
  09. ConversationList.tsx     — lista de conversas (fixadas, grupos, diretas)
  10. ChatLayout.tsx           — layout 2 painéis (lista | thread) + header
```

### 2.13 Pages de Chat

**Arquivos:**
```
src/app/gestao/chat/page.tsx                  — layout com ConversationList + ChatThread
src/app/gestao/chat/[conversationId]/page.tsx — rota deep-link para conversa
```

### 2.14 Modal Criar Grupo

**Arquivo:** `src/components/gestao/modals/CreateGroupModal.tsx`

- Campo nome
- Busca de membros
- Chips dos selecionados
- Checkbox "Incluir Clara (IA)"

### 2.15 Sheet Perfil do Membro

**Arquivo:** `src/components/gestao/modals/MemberProfileSheet.tsx`

- Avatar + nome + role + status
- Estatísticas semanais (via `/api/gestao/dashboard/workload`)
- Tarefas ativas
- Botões: Enviar Mensagem, Atribuir Tarefa

### Entregável Fase 2

Ao final da Fase 2:
- Usuário navega para `/gestao` → vê Kanban com tarefas reais
- Arrasta cards entre colunas → atualiza em tempo real para outros
- Cria tarefa pelo modal → aparece na coluna
- Alterna para Lista / Calendário → vê mesmos dados
- Navega para Chat → vê conversas, envia mensagens, reage, fixa
- Cria grupo → adiciona membros → conversa
- Presença online funciona (dots verdes)

---

## FASE 3 — Inteligência & Polish

> **Objetivo:** Dashboard, Clara no chat, notificações, Command Palette, responsividade, migração final.

### 3.1 API Routes — Dashboard (5 endpoints)

```
49. GET /api/gestao/dashboard/kpis      — KPIs com deltas comparativos
50. GET /api/gestao/dashboard/chart     — dados para gráfico de linha (criadas vs concluídas por dia)
51. GET /api/gestao/dashboard/workload  — workload por membro
52. GET /api/gestao/dashboard/ranking   — ranking semanal
53. GET /api/gestao/dashboard/overdue   — tarefas atrasadas (paginado)
```

**Todos com `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`** (errata §11.5.4)

**KPIs com deltas:** Query compara `COUNT(*) FILTER (WHERE created_at >= start_of_current_period)` vs `COUNT(*) FILTER (WHERE created_at >= start_of_previous_period AND created_at < start_of_current_period)`.

### 3.2 Componentes de Dashboard

**Arquivos:**
```
src/app/gestao/dashboard/page.tsx
src/components/gestao/dashboard/
  ├── DashboardGrid.tsx        — bento grid layout
  ├── KPICards.tsx             — 4 cards com NumberFlow (animação)
  ├── TaskChart.tsx            — gráfico recharts (2 linhas: criadas + concluídas)
  ├── WorkloadBar.tsx          — barras horizontais por membro
  ├── WeeklyRanking.tsx        — lista rankeada com medalhas
  └── OverdueTasks.tsx         — lista de tarefas atrasadas com link
```

### 3.3 Hook `useGestaoNotifications`

**Arquivo:** `src/hooks/useGestaoNotifications.ts`

```
Estado:
- notifications: GestaoNotification[]
- unreadCount: number

Realtime:
- Canal: gestao:notifications:{userId}
- postgres_changes em gestao.notifications (INSERT)

Mutations:
- markAsRead(id)
- markAllAsRead()

Integração:
- Toast via sonner quando nova notificação chega
- Badge na TopBar (integrar com NotificationBell existente)
```

### 3.4 API Routes — Notificações (3 endpoints)

```
54. GET   /api/gestao/notifications          — listar (paginado)
55. PATCH /api/gestao/notifications/read     — marcar específicas como lidas
56. PATCH /api/gestao/notifications/read-all — marcar todas como lidas
```

### 3.5 Cron de Notificações

**Arquivo:** `src/app/api/cron/gestao-notifications/route.ts`

- Roda diariamente às 08:00 BRT (via Vercel Cron ou Supabase pg_cron)
- Gera notificações `task_due_soon` (prazo amanhã) e `task_overdue` (vencidas)
- Deduplicação: `NOT EXISTS (notif com mesmo entity_id e type criada hoje)`

### 3.6 Sistema de Toasts (Sonner)

**Arquivo:** `src/components/gestao/shared/GestaoToastProvider.tsx`

- Provider global com `<Toaster />` do sonner
- Integrado com `useGestaoNotifications` — nova notificação → toast
- Posição: bottom-right
- 4 variantes: default, success, warning, error

### 3.7 Notification Bell Integrada

**Modificação em:** `src/components/TopBar.tsx`

- Adicionar badge que soma `chatInternalUnread + gestaoUnread`
- Popover com lista de notificações (componente `NotificationPopover`)
- Tabs: Todas | Não lidas
- Botão "Marcar tudo como lido"

### 3.8 Clara no Chat (IA)

**Arquivos:**

```
src/ai/clara/tools/gestao_tools.ts  — 6 tools novas
src/app/api/gestao/chat/clara/route.ts — endpoint processador da fila
```

**Tools:**
1. `create_gestao_task` — INSERT em gestao.tasks
2. `update_gestao_task` — UPDATE em gestao.tasks
3. `list_gestao_tasks` — SELECT com filtros
4. `summarize_thread` — sumarizar thread de mensagens
5. `get_team_workload` — vw_user_workload
6. `search_chat_history` — busca em internal_messages

**Fluxo @Clara:**
1. Trigger `detect_clara_mention` → INSERT em `clara_queue`
2. Endpoint `/api/gestao/chat/clara` (chamado por webhook ou polling)
3. Broadcast `gestao:clara:status` → 'thinking'
4. Invoca grafo da Clara com contexto do grupo + tools de gestão
5. Clara responde → INSERT em `internal_messages` (sender_id = UUID reservado)
6. Broadcast `gestao:clara:status` → 'done'

**Componente `ClaraMessage.tsx`:**
```
src/components/gestao/chat/ClaraMessage.tsx — mensagem especial com:
  - Avatar com borda gradient + badge 🤖
  - Botões de ação inline (Sim/Não, Criar tarefa, Ver lista)
  - Indicador "Clara está pensando..." (3 dots)
  - Markdown rendering (react-markdown)
```

### 3.9 Command Palette (⌘K)

**Arquivos:**
```
src/components/gestao/shared/CommandPalette.tsx
src/hooks/useCommandPalette.ts
```

**Dependência:** `cmdk`

**Categorias:**
1. Ações Rápidas — Criar tarefa (Ctrl+N), Nova conversa (Ctrl+M), Criar grupo
2. Tarefas Recentes — 5 últimas acessadas
3. Pessoas — Membros da equipe com status
4. Navegação — G→K (Kanban), G→L (Lista), G→C (Chat), G→D (Dashboard)
5. Clara — Input livre para perguntar à IA

**Atalhos globais:** registrar via `useEffect` no layout.tsx do `/gestao`

### 3.10 Responsividade

**Ajustes por breakpoint:**

| Breakpoint | Mudança |
|-----------|---------|
| `< 640px` | Sidebar oculta (drawer via botão hambúrguer), modais viram drawers (vaul), chat fullscreen |
| `640-1024px` | Sidebar colapsada (ícones), Kanban scroll horizontal com 2 colunas visíveis |
| `> 1024px` | Layout completo |

**Arquivos a modificar:**
- `GestaoSidebar.tsx` — estado `collapsed`, drawer no mobile
- `KanbanBoard.tsx` — `overflow-x-auto` + `min-w-[300px]` por coluna
- `ChatLayout.tsx` — lista e thread em telas separadas no mobile (navegação)
- `CreateTaskModal.tsx` / `TaskDetailModal.tsx` — usar `responsive-modal` (Dialog + Drawer)

### 3.11 Dark Mode

Todos os componentes da Fase 2 já devem usar classes `dark:` do Tailwind.
Nesta fase: revisão final de todas as cores conforme PRD Frontend §14.

### 3.12 Migração Final

**Arquivo:** `src/app/tasks/page.tsx` (modificar)

```typescript
// Redirect condicional
if (process.env.GESTAO_MIGRATION_COMPLETE === 'true') {
  redirect('/gestao')
}
// ... código antigo permanece como fallback
```

**Coexistência:**
- `/tasks` continua funcionando enquanto `GESTAO_MIGRATION_COMPLETE !== 'true'`
- `InternalChatContext` coexiste — dentro de `/gestao` usa hooks novos, fora usa antigo
- Após validação em produção, setar env var e remover código antigo

### Entregável Fase 3

Ao final da Fase 3:
- Dashboard com KPIs animados, gráficos, ranking, workload
- @Clara no chat funciona — responde, cria tarefas, sumariza
- Notificações em tempo real (toast + bell + badge)
- ⌘K abre Command Palette com busca fuzzy
- Sistema 100% responsivo (mobile, tablet, desktop)
- Dark mode completo
- `/tasks` redireciona para `/gestao`

---

## Contagem Final de Artefatos

| Categoria | Quantidade |
|-----------|-----------|
| Arquivos SQL | 2 (schema + seed) |
| Tipos TypeScript | 1 (gestao.ts) |
| Helpers | 3 (auth, validators, realtime) |
| API Routes | 58 endpoints em ~35 arquivos |
| Hooks React | 6 |
| Componentes | ~45 |
| Pages | 6 |
| Scripts | 1 (migration) |
| **Total de arquivos novos** | **~95** |

---

## Ordem de Execução Recomendada (Dia a Dia)

### Fase 1 (estimativa: é a base de tudo)
```
1.1  gestao_schema.sql
1.2  gestao_seed.sql + executar no Supabase
1.3  src/types/gestao.ts
1.4  gestao-auth.ts + gestao-validators.ts + gestao-realtime.ts
1.5  API Bloco A (boards + columns) — 8 endpoints
1.6  API Bloco B (tasks CRUD) — 12 endpoints
1.7  API Bloco C (comments + checklist + labels) — 6 endpoints
1.8  scripts/migrate-tasks-to-gestao.ts
     → VALIDAR: todas as APIs retornam dados corretos
```

### Fase 2 (maior fase — UI intensiva)
```
2.1  npm install deps
2.2  layout.tsx + GestaoSidebar + GestaoToolbar + ViewTabs
2.3  Shared components (UserAvatar, PriorityBadge, LabelTag, etc.)
2.4  responsive-modal.tsx
2.5  useGestaoBoard hook
2.6  KanbanCard → KanbanColumn → KanbanBoard → page.tsx
     → VALIDAR: Kanban renderiza e DnD funciona
2.7  CreateTaskModal + TaskDetailModal
2.8  TaskTable + TaskTableRow + BulkActions + /gestao/lista/page.tsx
2.9  TaskCalendar + CalendarDayPopover + /gestao/calendario/page.tsx
2.10 API Bloco D+E+F+G (chat — 18 endpoints)
2.11 useGestaoChat + useGestaoPresence hooks
2.12 Chat components (01→10 em ordem)
2.13 Chat pages + CreateGroupModal + MemberProfileSheet
     → VALIDAR: Chat funciona end-to-end com realtime
```

### Fase 3 (polimento e inteligência)
```
3.1  API Dashboard (5 endpoints)
3.2  Dashboard components + page
3.3  useGestaoNotifications hook
3.4  API Notificações (3 endpoints) + Cron
3.5  GestaoToastProvider + integrar TopBar
3.6  Clara tools + /api/gestao/chat/clara + ClaraMessage.tsx
3.7  CommandPalette + useCommandPalette + atalhos globais
3.8  Responsividade (revisão de todos os componentes)
3.9  Dark mode (revisão final)
3.10 Migration redirect + testes finais
     → VALIDAR: sistema completo funcional
```

---

> Plano de implementação completo. Cada item é atômico e pode ser implementado em sequência.
> Total: 58 endpoints, ~95 arquivos novos, ~45 componentes, 6 hooks, 6 pages.
