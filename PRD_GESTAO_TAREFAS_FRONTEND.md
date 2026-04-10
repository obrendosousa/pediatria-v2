# PRD — Gestão de Tarefas & Chat Interno (Frontend)

> **Versão:** 1.0
> **Data:** 2026-04-09
> **Fase atual:** 1 de 3 (Planejamento Frontend)
> **Rota:** `/gestao` (substitui `/tasks`)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura de Telas](#2-arquitetura-de-telas)
3. [Layout Principal](#3-layout-principal)
4. [Tela 1 — Kanban Board](#4-tela-1--kanban-board)
5. [Tela 2 — Chat Interno](#5-tela-2--chat-interno)
6. [Tela 3 — Dashboard de Produtividade](#6-tela-3--dashboard-de-produtividade)
7. [Componentes Compartilhados](#7-componentes-compartilhados)
8. [Modais e Sheets](#8-modais-e-sheets)
9. [Command Palette](#9-command-palette)
10. [Sistema de Notificações](#10-sistema-de-notificações)
11. [Componentes 21st.dev Mapeados](#11-componentes-21stdev-mapeados)
12. [Dependências Necessárias](#12-dependências-necessárias)
13. [Estrutura de Arquivos](#13-estrutura-de-arquivos)
14. [Responsividade e Dark Mode](#14-responsividade-e-dark-mode)

---

## 1. Visão Geral

Substituir a tela `/tasks` (agenda + mural individual) por um **hub de gestão completo** que combina:

- **Kanban compartilhado** com drag-and-drop e delegação de tarefas
- **Chat interno** evoluído com grupos, threads, IA (Clara) e conversão mensagem→tarefa
- **Dashboard** com métricas de produtividade da equipe

### Referências de Mercado
- **ClickUp**: chat nativo + tasks + Super Agents IA
- **Linear**: UI sub-100ms, keyboard-first, command palette
- **Monday.com**: boards visuais, density toggle
- **Notion**: views múltiplas, database automations

---

## 2. Arquitetura de Telas

```
/gestao (layout com sidebar própria)
├── /gestao              → Kanban Board (default)
├── /gestao/lista        → View de Lista/Tabela
├── /gestao/calendario   → View de Calendário
├── /gestao/chat         → Chat Interno (full page)
├── /gestao/chat/[id]    → Thread específica
└── /gestao/dashboard    → Dashboard de Produtividade
```

### Navegação entre views (mesma sidebar):
- Tabs no topo: **Kanban** | **Lista** | **Calendário**
- Sidebar: **Chat** | **Dashboard** como seções separadas

---

## 3. Layout Principal

### 3.1 Estrutura

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (existente — já implementada)                    │
├────────┬────────────────────────────────────────────────┤
│        │  Toolbar: [Filtros] [Busca] [View Toggle]     │
│        │           [+ Nova Tarefa]  [Cmd+K]            │
│ Side   ├────────────────────────────────────────────────┤
│ bar    │                                                │
│        │  Conteúdo Principal                            │
│ Nav    │  (Kanban / Lista / Calendário /                │
│        │   Chat / Dashboard)                            │
│        │                                                │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│ Status Bar (opcional): Clara status + users online      │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Sidebar de Navegação

> **Componente 21st.dev:** `Sidebar Component` (similaridade 1.922)
> **Componente 21st.dev alternativo:** `Modern sideBar` (similaridade 1.534)

```
┌──────────────────┐
│ 🏥 Gestão        │  ← Título do módulo
│                  │
│ ─── TAREFAS ──── │  ← Seção
│ 📋 Kanban        │  ← Item ativo (highlight)
│ 📝 Lista         │
│ 📅 Calendário    │
│                  │
│ ─── EQUIPE ───── │  ← Seção
│ 💬 Chat          │  ← Com badge de unread count
│ 📊 Dashboard     │
│                  │
│ ─── PROJETOS ─── │  ← Seção (expansível)
│ ▶ Recepção       │  ← Submenu colapsável
│ ▶ Pediatria      │
│ ▶ Financeiro     │
│ ▶ Comercial      │
│                  │
│ ─────────────── │
│ ⚙ Configurações │
│ 👤 Meu Perfil    │
│                  │
│ [◀] Recolher     │  ← Toggle colapsar sidebar
└──────────────────┘
```

**Botões da Sidebar:**

| Botão | Ícone (lucide) | Ação | Estado |
|-------|---------------|------|--------|
| Kanban | `LayoutGrid` | Navega para `/gestao` | `isActive` highlight azul |
| Lista | `List` | Navega para `/gestao/lista` | `isActive` highlight |
| Calendário | `Calendar` | Navega para `/gestao/calendario` | `isActive` highlight |
| Chat | `MessageCircle` | Navega para `/gestao/chat` | Badge com unread count |
| Dashboard | `BarChart3` | Navega para `/gestao/dashboard` | `isActive` highlight |
| Projeto (cada) | `FolderKanban` | Expande submenu | Chevron rotaciona |
| Configurações | `Settings` | Abre modal settings | — |
| Meu Perfil | `User` | Abre sheet de perfil | — |
| Recolher | `PanelLeftClose` | Toggle sidebar colapsada | Alterna ícone |

**Comportamento:**
- Sidebar colapsável (ícones only quando recolhida)
- Tooltip com nome do item quando colapsada
- Projetos são submenus expansíveis com boards específicos
- Badge animado (pulse) no Chat quando há mensagens não lidas
- Width: 260px expandida / 64px colapsada

---

## 4. Tela 1 — Kanban Board

### 4.1 Toolbar Superior

> **Componente 21st.dev:** `Filters` (similaridade 4.617) — filtros estilo Linear
> **Componente 21st.dev:** `Tabs Multi-variant` (similaridade 0.15) — variante `pill`

```
┌─────────────────────────────────────────────────────────────────┐
│ [Kanban ●] [Lista] [Calendário]   |  🔍 Buscar...   [⌘K]     │
│                                                                 │
│ [+ Filtro ▾] Responsável: João ✕  Prioridade: Alta ✕  [Limpar]│
│                                                                 │
│ [+ Nova Tarefa]  [👤 Membros ▾]  [⚙ Board Settings]  [⋯ Mais] │
└─────────────────────────────────────────────────────────────────┘
```

**Botões da Toolbar:**

| Botão | Ícone | Tipo | Ação | Componente 21st |
|-------|-------|------|------|-----------------|
| View Tabs (Kanban/Lista/Cal) | — | `Tabs pill` | Alterna view | Tabs Multi-variant |
| Buscar | `Search` | Input | Busca fuzzy em tarefas | — (input nativo) |
| Cmd+K | `Command` | Badge/shortcut | Abre Command Palette | Command Palette |
| + Filtro | `Filter` | Dropdown | Adiciona filtro ativo | Filters (Linear style) |
| Chip de filtro ativo | — | Badge removível | Remove filtro ao clicar ✕ | Filters (chip) |
| Limpar filtros | `X` | Text button | Remove todos os filtros | — |
| + Nova Tarefa | `Plus` | Button primary | Abre modal criar tarefa | — |
| Membros | `Users` | Dropdown | Filtra por membro | — |
| Board Settings | `Settings` | Button ghost | Abre sheet config board | — |
| Mais | `MoreHorizontal` | Dropdown | Export, Import, Archive | Dropdown Menu |

**Filtros disponíveis (sistema de Filters):**

| Filtro | Tipo | Operadores |
|--------|------|-----------|
| Responsável | Select (avatar + nome) | is, is not |
| Prioridade | Select (Urgente/Alta/Média/Baixa) | is, is not |
| Status | Select (colunas do board) | is, is not |
| Prazo | Date range | before, after, between, overdue |
| Label | Multi-select | includes, excludes |
| Criador | Select (avatar + nome) | is, is not |
| Módulo/Projeto | Select | is, is not |

### 4.2 Kanban Board (Área Principal)

> **Componente 21st.dev:** `Kanban (DnD Kit)` — colunas com drag-and-drop
> **Componente 21st.dev alternativo:** `Issue Kanban (Issue Grid)` — cards estilo Linear

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📋 BACKLOG (5)│ │ 🔄 FAZENDO (3)│ │ 👀 REVISÃO (2)│ │ ✅ FEITO (8)  │
│ ──────────── │ │ ──────────── │ │ ──────────── │ │ ──────────── │
│              │ │              │ │              │ │              │
│ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ │ Task Card│ │ │ │ Task Card│ │ │ │ Task Card│ │ │ │ Task Card│ │
│ │ (detalhe │ │ │ │          │ │ │ │          │ │ │ │          │ │
│ │  abaixo) │ │ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
│ └──────────┘ │ │              │ │              │ │              │
│              │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
│ ┌──────────┐ │ │ │ Task Card│ │ │ │ Task Card│ │ │ │ Task Card│ │
│ │ Task Card│ │ │ │          │ │ │ │          │ │ │ │          │ │
│ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
│              │ │              │ │              │ │              │
│ [+ Adicionar]│ │ [+ Adicionar]│ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
                                                    [+ Nova Coluna]
```

**Botões/Elementos de cada Coluna:**

| Elemento | Ícone | Ação |
|----------|-------|------|
| Título da coluna | Editável inline (double-click) | Renomear coluna |
| Counter `(N)` | — | Contagem de cards |
| Menu da coluna `⋯` | `MoreHorizontal` | Renomear, Cor, WIP Limit, Mover, Deletar |
| `+ Adicionar` | `Plus` | Criar tarefa rápida inline |
| `+ Nova Coluna` (ao final) | `Plus` | Adicionar coluna ao board |

**Drag-and-drop:**
- Cards arrastáveis entre colunas (reordenar posição)
- Colunas reordenáveis (drag no header)
- Visual: ghost card semi-transparente durante arraste
- Indicador de drop zone (linha azul entre cards)
- Animação spring ao soltar (framer-motion)

### 4.3 Task Card (Card Individual)

> **Componente 21st.dev base:** `Issue Kanban (Issue Grid)` — layout de card estilo Linear
> **Componente 21st.dev:** `Label Badges` — labels coloridas
> **Componente 21st.dev:** `Status` — indicador de prioridade

```
┌─────────────────────────────────────┐
│ 🔴 Alta    📋 Recepção   ⋯        │ ← Prioridade + Label + Menu
│                                     │
│ Confirmar retornos da semana        │ ← Título (font-medium)
│                                     │
│ Ligar para pacientes que faltaram   │ ← Descrição (text-muted, truncate 2 linhas)
│ à consulta de segunda-feira...      │
│                                     │
│ ☑ 2/4 checklist                    │ ← Progresso do checklist
│ ────────────────── 50%             │ ← Progress bar
│                                     │
│ 📅 12 Abr  👤 João  💬 3          │ ← Prazo + Assignee + Comments count
└─────────────────────────────────────┘
```

**Elementos do Task Card:**

| Elemento | Ícone/Visual | Ação ao clicar | Componente 21st |
|----------|-------------|----------------|-----------------|
| Indicador de prioridade | Dot colorido (🔴🟠🟡🔵⚪) | — | Status (dot animado) |
| Label/Tag | Badge colorida | Filtra por label | Label Badges |
| Menu `⋯` | `MoreHorizontal` | Dropdown de ações | Dropdown Menu |
| Título | Texto bold | Abre modal de detalhe | — |
| Descrição | Texto muted (truncado) | Abre modal de detalhe | — |
| Checklist progress | `CheckSquare` + contagem | Abre modal com checklist | — |
| Progress bar | Barra colorida | — | Progress (Ark UI) |
| Data de prazo | `Calendar` + data | — (vermelho se overdue) | — |
| Avatar assignee | Foto circular | Tooltip com nome | Avatar (ReUI) com Status |
| Comment count | `MessageSquare` + número | Abre modal na aba comments | — |
| Drag handle | `GripVertical` (hover) | Inicia drag-and-drop | DnD Kit |

**Cores de prioridade:**

| Prioridade | Cor do dot | Cor do badge | CSS class |
|-----------|-----------|-------------|-----------|
| Urgente | `bg-red-500` | `bg-red-100 text-red-700` | `priority-urgent` |
| Alta | `bg-orange-500` | `bg-orange-100 text-orange-700` | `priority-high` |
| Média | `bg-yellow-500` | `bg-yellow-100 text-yellow-700` | `priority-medium` |
| Baixa | `bg-blue-500` | `bg-blue-100 text-blue-700` | `priority-low` |
| Nenhuma | `bg-gray-400` | `bg-gray-100 text-gray-500` | `priority-none` |

**Dropdown Menu do Card (⋯):**

> **Componente 21st.dev:** `Dropdown Menu (Rich Menu)` (similaridade 2.496)

| Item | Ícone | Shortcut | Ação |
|------|-------|----------|------|
| Editar | `Pencil` | `E` | Abre modal edição |
| Duplicar | `Copy` | `Cmd+D` | Duplica card |
| ─── separador ─── | | | |
| Mover para... | `ArrowRight` ▶ | — | Submenu: lista de colunas |
| Atribuir a... | `UserPlus` ▶ | — | Submenu: lista de membros |
| Alterar prioridade | `Signal` ▶ | — | Submenu: Urgente/Alta/Média/Baixa |
| ─── separador ─── | | | |
| Copiar link | `Link` | `Cmd+L` | Copia URL da tarefa |
| Converter em mensagem | `MessageSquare` | — | Envia card como msg no chat |
| ─── separador ─── | | | |
| Arquivar | `Archive` | — | Move para arquivo |
| Deletar | `Trash2` | `Backspace` | Modal de confirmação (vermelho) |

### 4.4 View de Lista (Tabela)

> **Componente 21st.dev:** `Data Grid Table` (similaridade 0.206) — com column controls

```
┌────┬──────────────────────┬──────────┬──────────┬──────────┬──────────┬────────┐
│ ☐  │ Título               │ Status   │ Priorid. │ Responsá.│ Prazo    │ ⋯     │
├────┼──────────────────────┼──────────┼──────────┼──────────┼──────────┼────────┤
│ ☐  │ Confirmar retornos   │ 🔄 Fazendo│ 🔴 Alta  │ 👤 João  │ 12 Abr   │ ⋯     │
│ ☐  │ Organizar prontuários│ 📋 Backlog│ 🟡 Média │ 👤 Maria │ 15 Abr   │ ⋯     │
│ ☐  │ Reunião de equipe    │ 📋 Backlog│ 🔵 Baixa │ 👤 Ana   │ 18 Abr   │ ⋯     │
│ ☑  │ ~~Enviar relatório~~ │ ✅ Feito  │ 🔴 Alta  │ 👤 João  │ ~~10 Abr~~│ ⋯     │
└────┴──────────────────────┴──────────┴──────────┴──────────┴──────────┴────────┘
│ Mostrando 1-25 de 142 tarefas            [◀ Anterior] [Próximo ▶]            │
```

**Botões da tabela:**

| Elemento | Ação |
|----------|------|
| Checkbox (header) | Seleciona todos → barra de ações em lote |
| Checkbox (row) | Seleciona tarefa individual |
| Header sortável (clicável) | Ordena ASC/DESC com ícone `ArrowUpDown` |
| Row hover | Destaque de fundo + mostra `⋯` |
| `⋯` por row | Mesmo dropdown do card Kanban |
| Paginação | Anterior/Próximo com contagem |

**Ações em lote (quando > 1 selecionado):**

```
┌─────────────────────────────────────────────────────────────────┐
│ 3 selecionadas  [Mover para ▾] [Atribuir ▾] [Prioridade ▾] [🗑]│
└─────────────────────────────────────────────────────────────────┘
```

| Botão | Ícone | Ação |
|-------|-------|------|
| Mover para | `ArrowRight` | Dropdown com colunas |
| Atribuir | `UserPlus` | Dropdown com membros |
| Prioridade | `Signal` | Dropdown com prioridades |
| Deletar | `Trash2` | Modal confirmação (em lote) |

### 4.5 View de Calendário

> **Componente 21st.dev:** `Calendar [React-Aria]` (similaridade 0.518)
> **Componente 21st.dev:** `Event Calendar` — eventos inline

```
┌─────────────────────────────────────────────────────────┐
│  ◀  Abril 2026  ▶          [Hoje]  [Dia] [Semana] [Mês]│
├───────┬───────┬───────┬───────┬───────┬───────┬───────┤
│  Dom  │  Seg  │  Ter  │  Qua  │  Qui  │  Sex  │  Sáb  │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│       │       │       │   1   │   2   │   3   │   4   │
│       │       │       │       │ ●● 2  │       │       │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│   5   │   6   │   7   │   8   │  *9*  │  10   │  11   │
│       │ ●●● 3 │ ● 1   │       │ TODAY │ ● 1   │       │
│       │ 🔴    │       │       │ ●● 2  │       │       │
├───────┼───────┼───────┼───────┼───────┼───────┼───────┤
│  12   │  13   │  14   │  15   │  16   │  17   │  18   │
│ ● 1   │       │ ●● 2  │ ● 1   │       │       │       │
│       │       │ 🔴    │       │       │       │       │
└───────┴───────┴───────┴───────┴───────┴───────┴───────┘
```

**Botões do calendário:**

| Botão | Ícone | Ação |
|-------|-------|------|
| `◀` (mês anterior) | `ChevronLeft` | Navega mês anterior |
| `▶` (próximo mês) | `ChevronRight` | Navega próximo mês |
| Hoje | — | Volta para data atual |
| Dia/Semana/Mês | Tabs | Alterna granularidade |
| Dot em dia | Dot colorido (prioridade) | — |
| Clique no dia | — | Expande dia com lista de tarefas |
| Clique em `+` no dia | `Plus` | Cria tarefa naquela data |

---

## 5. Tela 2 — Chat Interno

### 5.1 Layout do Chat (Full Page)

```
┌──────────────────┬──────────────────────────────────────────────┐
│                  │ Header do Chat                                │
│ Lista de         │ 👤 João Silva  ● Online          🔍 📌 ⋯    │
│ Conversas        ├──────────────────────────────────────────────┤
│                  │                                              │
│ 🔍 Buscar...     │  Mensagens                                   │
│                  │                                              │
│ ─── FIXADAS ──── │  👤 Maria (10:30)                            │
│ 📌 Recepção      │  Pessoal, precisa confirmar os              │
│                  │  retornos de amanhã                          │
│ ─── GRUPOS ───── │                                              │
│ 👥 Recepção (3)  │      Pode deixar, já faço! (10:32) 👤       │
│ 👥 Médicos (2)   │                                              │
│ 👥 Financeiro    │  👤 Clara 🤖 (10:33)                        │
│ 👥 + Clara AI    │  Encontrei 12 retornos pendentes             │
│                  │  para amanhã. Quer que eu crie              │
│ ─── DIRETAS ──── │  tarefas para cada um?                      │
│ 👤 João ●        │  [Sim, criar tarefas] [Ver lista]           │
│ 👤 Maria ●       │                                              │
│ 👤 Ana ○         │  🤖 → 📋 Criou 12 tarefas no Kanban        │
│ 👤 Dr. Carlos ○  │                                              │
│                  ├──────────────────────────────────────────────┤
│ ─────────────── │                                              │
│ [+ Novo Grupo]   │ [😊] [📎] [📋→] [@]  Digite uma mensagem... │
│ [+ Nova Conversa]│                                    [Enviar ▶]│
└──────────────────┴──────────────────────────────────────────────┘
```

### 5.2 Lista de Conversas (Painel Esquerdo)

> **Componente 21st.dev:** `Messaging Conversation` — lista de conversas
> **Componente 21st.dev:** `Avatar (ReUI) com Status` — presença online

**Elementos da lista:**

| Elemento | Visual | Ação |
|----------|--------|------|
| Campo de busca | Input com `Search` icon | Filtra conversas/contatos |
| Seção "Fixadas" | Header com `Pin` icon | — |
| Seção "Grupos" | Header com `Users` icon | — |
| Seção "Diretas" | Header com `User` icon | — |
| Item de conversa (grupo) | Avatar empilhado + nome + preview + hora + unread badge | Abre conversa |
| Item de conversa (direta) | Avatar + status dot + nome + preview + hora + unread badge | Abre conversa |
| `+ Novo Grupo` | `UsersPlus` | Abre modal criar grupo |
| `+ Nova Conversa` | `MessageSquarePlus` | Abre modal selecionar usuário |

**Avatar com status online:**

| Status | Cor do dot | Animação |
|--------|-----------|----------|
| Online | `bg-emerald-500` | Ping pulse |
| Ausente | `bg-amber-500` | — |
| Ocupado | `bg-red-500` | — |
| Offline | `bg-gray-400` | — |

**Context menu (botão direito na conversa):**

| Item | Ícone | Ação |
|------|-------|------|
| Fixar | `Pin` | Toggle fixar no topo |
| Silenciar | `BellOff` | Muta notificações |
| Marcar como lida | `CheckCheck` | Zera unread count |
| Arquivar | `Archive` | Move para arquivadas |
| Sair do grupo | `LogOut` | (só em grupos) Remove participação |
| Deletar | `Trash2` | Modal confirmação |

### 5.3 Área de Mensagens (Painel Central)

#### Header do Chat

```
┌──────────────────────────────────────────────────────────────┐
│ 👤👤👤 Recepção (5 membros)   ● 3 online    🔍  📌  📋  ⋯  │
└──────────────────────────────────────────────────────────────┘
```

| Botão | Ícone | Ação |
|-------|-------|------|
| Avatares empilhados | `Avatar Group` | Tooltip com nomes dos membros |
| Info "N online" | — | Mostra quem está online |
| Buscar no chat | `Search` | Toggle barra de busca na conversa |
| Mensagens fixadas | `Pin` | Abre painel lateral com pinned |
| Tarefas do chat | `ClipboardList` | Abre painel lateral com tarefas vinculadas |
| Menu | `MoreVertical` | Info do grupo, membros, mídia compartilhada |

#### Mensagem Individual (Bubble)

> **Componente 21st.dev:** `Message` (composable) — bubbles com avatar
> **Componente 21st.dev:** `Reddit Nested Thread Reply` — para threads

```
┌─ Mensagem de outro ─────────────────────────────┐
│ 👤 Maria · Secretária · 10:30                   │
│                                                  │
│ Pessoal, precisa confirmar os retornos           │
│ de amanhã. São 12 pacientes.                     │
│                                                  │
│ 😀 2  👍 1  |  💬 Responder  📋 Criar tarefa    │
└──────────────────────────────────────────────────┘

┌─ Mensagem própria ──────────────────────────────┐
│                                       10:32  ✓✓ │
│                                                  │
│              Pode deixar, já faço!               │
│                                                  │
└──────────────────────────────────────────────────┘

┌─ Mensagem da Clara (IA) ────────────────────────┐
│ 🤖 Clara · Assistente IA · 10:33                │
│                                                  │
│ Encontrei 12 retornos pendentes para amanhã.     │
│ Quer que eu crie tarefas para cada um?           │
│                                                  │
│ [Sim, criar tarefas]  [Ver lista primeiro]       │
│                                                  │
│ 😀 3  |  💬 Responder                           │
└──────────────────────────────────────────────────┘
```

**Elementos de cada mensagem:**

| Elemento | Ação | Condição |
|----------|------|----------|
| Avatar | Abre perfil | Sempre (mensagens de outros) |
| Nome + Role | — | Mensagens de outros |
| Timestamp | — | Sempre |
| Status (✓✓) | — | Mensagens próprias (enviado/lido) |
| Reações (emoji + count) | Clica para reagir/des-reagir | Quando há reações |
| `+ Adicionar reação` | Abre emoji picker | Hover na mensagem |
| Responder em thread | `MessageSquare` | Hover na mensagem |
| Criar tarefa | `ClipboardList` | Hover na mensagem |
| Copiar texto | `Copy` | Hover → menu `⋯` |
| Fixar mensagem | `Pin` | Hover → menu `⋯` |
| Deletar | `Trash2` | Hover → menu `⋯` (só próprias ou admin) |
| Botões de ação da Clara | Buttons outlined | Mensagens da Clara com ações |

**Mensagem da Clara — Elementos especiais:**

| Elemento | Visual | Ação |
|----------|--------|------|
| Avatar com badge IA | `🤖` com borda gradient | Identifica como IA |
| Botões de ação | Buttons outlined | Executa ação via Clara |
| Card de tarefa criada | Mini-card inline | Clica para abrir tarefa |
| Indicador "digitando" | 3 dots animados | Aparece enquanto Clara processa |
| Markdown rendering | Rich text | Clara responde com formatação |

#### Input de Mensagem

> **Componente 21st.dev:** `Chat Input` (composable) — textarea auto-resize
> **Componente 21st.dev:** `Emoji Picker` (frimousse)
> **Componente 21st.dev:** `File Upload` — upload com preview

```
┌─────────────────────────────────────────────────────────────────┐
│ @Maria mencionada                                    ← mention │
│                                                                 │
│ [😊] [📎] [📋→] [@]  Digite uma mensagem...         [Enviar ▶] │
└─────────────────────────────────────────────────────────────────┘
```

**Botões do input:**

| Botão | Ícone | Ação | Componente 21st |
|-------|-------|------|-----------------|
| Emoji | `Smile` | Abre emoji picker popover | Emoji Picker (frimousse) |
| Anexo | `Paperclip` | Abre file picker + drag zone | File Upload |
| Criar tarefa | `ClipboardList` + `ArrowRight` | Abre modal criar tarefa pre-populada | — |
| Menção | `AtSign` | Ativa autocomplete de membros | Prompt Input (autocomplete) |
| Input text | Textarea auto-resize | Digita mensagem (Enter envia, Shift+Enter nova linha) | Chat Input |
| Enviar | `Send` | Envia mensagem | Chat Input Submit |

**Autocomplete de menções (@):**

> **Componente 21st.dev:** `Prompt Input with Actions` — autocomplete com highlight

```
┌──────────────────────────┐
│ @jo                      │
├──────────────────────────┤
│ 👤 João Silva       ● ←  │  highlight da busca
│ 👤 Joana Costa      ○    │
│ 🤖 Clara (IA)            │  ← sempre disponível
└──────────────────────────┘
```

| Elemento | Ação |
|----------|------|
| Item de membro | Clica para inserir menção |
| Avatar + nome + status | Visual de identificação |
| Clara (IA) | Sempre no final da lista, estilo especial |
| Highlight do texto digitado | Parte correspondente em bold |

### 5.4 Thread (Respostas Encadeadas)

> **Componente 21st.dev:** `Reddit Nested Thread Reply` — aninhamento recursivo

```
┌─ Painel Lateral de Thread ──────────────────────┐
│ 💬 Thread                               [✕]     │
│ ─────────────────────────────────────────────── │
│ 👤 Maria · 10:30                                │
│ Pessoal, precisa confirmar os retornos           │
│ de amanhã. São 12 pacientes.                     │
│ ─────────────────────────────────────────────── │
│ 3 respostas                                      │
│                                                  │
│ 👤 João · 10:32                                  │
│ Pode deixar, já faço!                            │
│                                                  │
│ 🤖 Clara · 10:33                                 │
│ Encontrei 12 retornos pendentes...               │
│                                                  │
│ 👤 Ana · 10:45                                   │
│ Já confirmei 5 deles por telefone                │
│                                                  │
├──────────────────────────────────────────────────┤
│ Responder nesta thread...              [Enviar ▶]│
└──────────────────────────────────────────────────┘
```

**Botões da thread:**

| Botão | Ícone | Ação |
|-------|-------|------|
| Fechar `✕` | `X` | Fecha painel de thread |
| Mensagem original | — | Contexto da thread (não editável) |
| Respostas | — | Lista de respostas cronológica |
| Input de resposta | Textarea | Responder na thread |
| Enviar | `Send` | Envia resposta na thread |

### 5.5 Painel de Informações do Grupo

```
┌─ Painel Lateral Info ───────────────────────────┐
│ ℹ️ Informações do Grupo               [✕]       │
│ ─────────────────────────────────────────────── │
│                                                  │
│        👥 Recepção                               │
│        Grupo · Criado em 01 Abr 2026             │
│                                                  │
│ ─── MEMBROS (5) ────────────────────── [+ Add]  │
│ 👤 Maria Silva    · Admin           ● Online     │
│ 👤 João Santos    · Membro          ● Online     │
│ 👤 Ana Costa      · Membro          ○ Offline    │
│ 👤 Dr. Carlos     · Membro          ○ Offline    │
│ 🤖 Clara          · IA              ● Sempre On  │
│                                                  │
│ ─── MÍDIA COMPARTILHADA ─────────── [Ver tudo]  │
│ 🖼 🖼 🖼 🖼 🖼 🖼                                │
│                                                  │
│ ─── TAREFAS VINCULADAS (3) ─────── [Ver tudo]   │
│ 📋 Confirmar retornos      🔴 Alta               │
│ 📋 Organizar prontuários   🟡 Média              │
│                                                  │
│ ─── AÇÕES ──────────────────────────────────── │
│ [🔔 Silenciar notificações]                     │
│ [📌 Fixar conversa]                              │
│ [🚪 Sair do grupo]                               │
└──────────────────────────────────────────────────┘
```

**Botões do painel de info:**

| Botão | Ícone | Ação |
|-------|-------|------|
| Fechar | `X` | Fecha painel |
| + Add membro | `UserPlus` | Abre modal selecionar usuários |
| Membro (clicável) | — | Abre perfil ou inicia conversa direta |
| Remover membro | `UserMinus` (hover) | Confirma remoção (só admin) |
| Ver tudo (mídia) | `ArrowRight` | Expande galeria de mídia |
| Ver tudo (tarefas) | `ArrowRight` | Lista completa de tarefas do chat |
| Silenciar | `BellOff` | Toggle mute |
| Fixar | `Pin` | Toggle pin no topo |
| Sair do grupo | `LogOut` | Modal confirmação |

---

## 6. Tela 3 — Dashboard de Produtividade

### 6.1 Layout

> **Componente 21st.dev:** `Combined Featured Section` (similaridade 0.616) — bento grid
> **Componente 21st.dev:** `KPI Card` — cards de métricas
> **Componente 21st.dev:** `Line Charts 6` — gráficos de linha

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Dashboard de Produtividade     [Hoje ▾] [Esta Semana ▾]     │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  📋 Total    │  ✅ Concluídas│  ⏰ Atrasadas │  📈 Taxa          │
│              │              │              │                    │
│    142       │     98       │     12       │    69%             │
│  +8 hoje     │  ↑ 15% sem   │  ↓ 3 sem     │  ↑ 5% sem         │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│                                                                 │
│  📈 Tarefas Concluídas por Dia                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │       ╱╲    ╱╲                                       │       │
│  │      ╱  ╲  ╱  ╲       ╱╲                             │       │
│  │  ╱╲╱    ╲╱    ╲╱╲   ╱  ╲                            │       │
│  │ ╱                 ╲╱                                  │       │
│  └──┬────┬────┬────┬────┬────┬────┬─────────────────────┘       │
│    Seg  Ter  Qua  Qui  Sex  Sáb  Dom                           │
│                                                                 │
├────────────────────────────────┬────────────────────────────────┤
│  👥 Workload da Equipe         │  🏆 Ranking Semanal            │
│                                │                                │
│  👤 João    ████████░░  80%   │  🥇 Maria   — 24 concluídas    │
│  👤 Maria   ██████████  100%  │  🥈 João    — 21 concluídas    │
│  👤 Ana     █████░░░░░  50%   │  🥉 Ana     — 15 concluídas    │
│  👤 Carlos  ███░░░░░░░  30%   │  4. Carlos  — 8 concluídas     │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│  🔴 Tarefas Atrasadas (12)                          [Ver todas] │
│                                                                 │
│  ● Confirmar retornos — João — venceu há 2 dias                 │
│  ● Enviar relatório mensal — Ana — venceu há 1 dia              │
│  ● Ligar fornecedor — Carlos — vence hoje                       │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Cards de KPI

> **Componente 21st.dev:** `KPI Card` — tone, trend, delta

**4 cards no topo:**

| Card | Valor | Delta | Trend | Tone | Ícone |
|------|-------|-------|-------|------|-------|
| Total de Tarefas | `142` | `+8 hoje` | `up` | `default` | `ClipboardList` |
| Concluídas | `98` | `↑ 15% semana` | `up` | `success` | `CheckCircle` |
| Atrasadas | `12` | `↓ 3 semana` | `down` | `danger` | `AlertTriangle` |
| Taxa de Conclusão | `69%` | `↑ 5% semana` | `up` | `primary` | `TrendingUp` |

### 6.3 Gráfico de Linha

> **Componente 21st.dev:** `Line Charts 6` — com ChartConfig e theming

- Eixo X: dias da semana/mês
- Eixo Y: quantidade de tarefas
- 2 linhas: Criadas (azul) + Concluídas (verde)
- Tooltip com valores ao hover
- Período selecionável: Hoje, Esta Semana, Este Mês, Customizado

### 6.4 Workload da Equipe

| Elemento | Visual | Ação |
|----------|--------|------|
| Avatar + nome | Foto + texto | Clica para ver tarefas do membro |
| Barra de progresso | Preenchida por % de capacidade | — |
| Percentual | Texto ao lado | — |
| Cor da barra | Verde (<70%), Amarelo (70-90%), Vermelho (>90%) | — |

### 6.5 Ranking Semanal

| Elemento | Visual | Ação |
|----------|--------|------|
| Posição (medalha) | 🥇🥈🥉 / número | — |
| Nome | Texto | Clica para perfil |
| Contagem | `N concluídas` | — |

### 6.6 Tarefas Atrasadas

| Elemento | Ação |
|----------|------|
| Dot vermelho + título | Clica para abrir modal da tarefa |
| Responsável | Clica para ver perfil |
| Tempo de atraso | Texto vermelho (ex: "venceu há 2 dias") |
| Ver todas | Navega para view lista filtrada por `overdue` |

---

## 7. Componentes Compartilhados

### 7.1 User Avatar com Status

> **Componente 21st.dev:** `Avatar (ReUI)` com `AvatarIndicator` + `AvatarStatus`

Props:
```typescript
interface UserAvatarProps {
  src: string | null
  name: string
  size: 'sm' | 'md' | 'lg'        // 24px, 32px, 40px
  status?: 'online' | 'offline' | 'away' | 'busy'
  showStatus?: boolean              // default: true
  isAI?: boolean                    // borda gradient para Clara
}
```

### 7.2 Avatar Group (Grupo de Avatares)

> **Componente 21st.dev:** `User Avatars` — empilhados com tooltip

Props:
```typescript
interface AvatarGroupProps {
  users: { src: string; name: string; role: string }[]
  maxVisible: number               // default: 4
  size: 'sm' | 'md' | 'lg'
  showTooltip?: boolean            // tooltip com nome + role
}
```

### 7.3 Priority Badge

> **Componente 21st.dev:** `Status` (dot animado) + `Label Badges`

Props:
```typescript
interface PriorityBadgeProps {
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none'
  showLabel?: boolean              // default: true
  showDot?: boolean                // default: true (dot animado para urgent)
}
```

### 7.4 Label Tag

> **Componente 21st.dev:** `Label Badges` — labels coloridas

Props:
```typescript
interface LabelTagProps {
  label: string
  color: string                    // hex color
  removable?: boolean              // mostra ✕ para remover
  onClick?: () => void
}
```

### 7.5 Empty State

> **Componente 21st.dev:** `Interactive Empty State` — animado, acessível

Usado quando:
- Kanban sem tarefas
- Chat sem conversas
- Busca sem resultados
- Filtro sem resultados

### 7.6 Skeleton Loading

> **Componente 21st.dev:** `Animated Loading Skeleton` — zero deps

Variantes:
- `SkeletonCard` — card de tarefa
- `SkeletonList` — row de tabela
- `SkeletonChat` — mensagem de chat
- `SkeletonKPI` — card de KPI

### 7.7 Typing Indicator

> **Componente 21st.dev:** `Animated AI Chat` (TypingDots) — 3 dots spring

Usado no chat quando alguém está digitando ou Clara está processando.

---

## 8. Modais e Sheets

### 8.1 Modal: Criar/Editar Tarefa

> **Componente 21st.dev:** `responsive-modal` — Dialog desktop + Drawer mobile

```
┌─ Criar Nova Tarefa ─────────────────────── [✕] ─┐
│                                                   │
│ Título *                                          │
│ ┌───────────────────────────────────────────────┐ │
│ │ Confirmar retornos da semana                  │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ Descrição                                         │
│ ┌───────────────────────────────────────────────┐ │
│ │ Ligar para pacientes que faltaram             │ │
│ │ à consulta de segunda-feira                   │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌──────────────────┐ ┌──────────────────────────┐ │
│ │ Status           │ │ Prioridade               │ │
│ │ [Backlog     ▾]  │ │ [🔴 Alta            ▾]  │ │
│ └──────────────────┘ └──────────────────────────┘ │
│                                                   │
│ ┌──────────────────┐ ┌──────────────────────────┐ │
│ │ Responsável      │ │ Prazo                    │ │
│ │ [👤 João     ▾]  │ │ [📅 12/04/2026       ]  │ │
│ └──────────────────┘ └──────────────────────────┘ │
│                                                   │
│ Labels                                            │
│ [Recepção ✕] [Urgente ✕] [+ Adicionar]           │
│                                                   │
│ Projeto                                           │
│ [📁 Geral                                    ▾]  │
│                                                   │
│ ─── Checklist ─────────────────── [+ Item] ───── │
│ ☐ Verificar lista de pacientes                    │
│ ☐ Ligar para cada paciente                        │
│ ☐ Atualizar prontuário                            │
│ ☐ Reportar no chat                                │
│                                                   │
│              [Cancelar]  [Criar Tarefa]           │
└───────────────────────────────────────────────────┘
```

**Campos e botões:**

| Campo | Tipo | Obrigatório | Componente |
|-------|------|-------------|------------|
| Título | Input text | Sim | Input (shadcn) |
| Descrição | Textarea auto-resize | Não | Textarea |
| Status | Select | Sim (default: Backlog) | Select (Radix) |
| Prioridade | Select com ícone | Sim (default: Média) | Priority Selector (cmdk) |
| Responsável | Select com avatar | Não | Combobox com avatares |
| Prazo | Date picker | Não | Calendar (react-day-picker) |
| Labels | Multi-select tags | Não | Label Badges + Popover |
| Projeto | Select | Sim (default: Geral) | Select (Radix) |
| Checklist | Lista dinâmica | Não | Checkbox + Input |
| + Item | `Plus` | Adiciona item ao checklist | Button ghost |
| Cancelar | — | Fecha modal | Button outline |
| Criar Tarefa | — | Salva e fecha | Button primary |

### 8.2 Modal: Detalhe da Tarefa

```
┌─ TASK-142 ─────────────────────────────── [✕] ─┐
│                                                   │
│  Confirmar retornos da semana             [⋯]    │
│  Criada por Maria · 8 Abr 2026                   │
│                                                   │
│  ┌─────────────────────┐ ┌────────────────────┐  │
│  │ Status: [Fazendo ▾] │ │ Prior: [🔴 Alta ▾] │  │
│  └─────────────────────┘ └────────────────────┘  │
│  ┌─────────────────────┐ ┌────────────────────┐  │
│  │ Resp: [👤 João ▾]   │ │ Prazo: [12/04 📅]  │  │
│  └─────────────────────┘ └────────────────────┘  │
│                                                   │
│  Labels: [Recepção] [Urgente] [+]                │
│                                                   │
│  ─── Descrição ──────────────────────────────── │
│  Ligar para pacientes que faltaram à consulta    │
│  de segunda-feira. Verificar se querem remarcar. │
│                                                   │
│  ─── Checklist (2/4) ───────────── [+ Item] ─── │
│  ☑ Verificar lista de pacientes                  │
│  ☑ Ligar para cada paciente                      │
│  ☐ Atualizar prontuário                          │
│  ☐ Reportar no chat                              │
│  ────────────────── 50%                          │
│                                                   │
│  ─── Atividade ──────────── [Comentários | Log] │
│                                                   │
│  👤 João · há 2h                                  │
│  Já liguei para 5 pacientes. 3 confirmaram.      │
│                                                   │
│  🤖 Clara · há 1h                                 │
│  Lembrete: faltam 7 pacientes para contatar.     │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Adicionar comentário...           [Enviar] │  │
│  └────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

**Botões do detalhe:**

| Botão/Campo | Ação | Nota |
|------------|------|------|
| `[⋯]` menu | Duplicar, Copiar link, Converter em msg, Arquivar, Deletar | Dropdown Menu |
| Status select | Altera coluna do Kanban inline | Atualização em tempo real |
| Prioridade select | Altera prioridade inline | Atualização em tempo real |
| Responsável select | Reatribui tarefa | Notifica novo responsável |
| Prazo date picker | Altera prazo | Destaca se overdue |
| Labels | Adiciona/remove labels | Multi-select popover |
| Checklist toggle | Marca/desmarca item | Atualiza progress bar |
| `+ Item` checklist | Adiciona item | Input inline |
| Tabs Comentários/Log | Alterna entre comentários e log de atividade | — |
| Input comentário | Adiciona comentário | Enter envia |
| `[Enviar]` | Publica comentário | Button primary |

### 8.3 Modal: Criar Grupo

```
┌─ Criar Novo Grupo ─────────────────────── [✕] ─┐
│                                                   │
│ Nome do Grupo *                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ Recepção                                      │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ Adicionar Membros                                 │
│ ┌───────────────────────────────────────────────┐ │
│ │ 🔍 Buscar membro...                           │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ Selecionados (3):                                 │
│ 👤 Maria Silva ✕  👤 João Santos ✕  🤖 Clara ✕   │
│                                                   │
│ Disponíveis:                                      │
│ ☐ 👤 Ana Costa                                    │
│ ☐ 👤 Dr. Carlos Mendes                            │
│ ☐ 👤 Fernanda Lima                                │
│                                                   │
│ ☑ Incluir Clara (IA) no grupo                    │
│                                                   │
│              [Cancelar]  [Criar Grupo]            │
└───────────────────────────────────────────────────┘
```

| Campo/Botão | Tipo | Ação |
|-------------|------|------|
| Nome do Grupo | Input text | Obrigatório |
| Buscar membro | Input search | Filtra lista de disponíveis |
| Membro selecionado (chip) | Badge com `✕` | Remove do grupo |
| Checkbox membro | Checkbox + avatar | Adiciona ao grupo |
| Incluir Clara | Checkbox especial | Adiciona IA ao grupo |
| Cancelar | Button outline | Fecha modal |
| Criar Grupo | Button primary | Cria grupo e abre conversa |

### 8.4 Sheet: Perfil do Membro

> **Componente 21st.dev:** `Profile Card` — com stats animados
> **Componente 21st.dev:** `Bio Card` — avatar + info

```
┌─ Perfil ─────────────────────── slide-in direita ─┐
│                                              [✕]   │
│         ┌──────┐                                    │
│         │ 👤   │  João Santos                       │
│         │      │  Secretário · Recepção              │
│         └──────┘  ● Online agora                    │
│                                                     │
│  📧 joao@clinica.com                                │
│  📱 (11) 99999-0000                                 │
│                                                     │
│  ─── Estatísticas Semanais ─────────────────────── │
│  📋 Tarefas atribuídas: 15                          │
│  ✅ Concluídas: 12 (80%)                            │
│  ⏰ Atrasadas: 1                                    │
│  ⏱ Tempo médio: 2.3 dias                            │
│                                                     │
│  ─── Tarefas Ativas ────────────────── [Ver todas] │
│  🔴 Confirmar retornos · Fazendo                    │
│  🟡 Organizar prontuários · Backlog                 │
│  🔵 Reunião de equipe · Backlog                     │
│                                                     │
│  ─── Ações ──────────────────────────────────────  │
│  [💬 Enviar Mensagem]  [📋 Atribuir Tarefa]        │
└─────────────────────────────────────────────────────┘
```

**Botões do perfil:**

| Botão | Ícone | Ação |
|-------|-------|------|
| Fechar | `X` | Fecha sheet |
| Enviar Mensagem | `MessageSquare` | Abre/cria conversa direta |
| Atribuir Tarefa | `ClipboardList` | Abre modal criar tarefa pré-atribuída |
| Ver todas (tarefas) | `ArrowRight` | Navega para lista filtrada pelo membro |
| Tarefa (clicável) | — | Abre modal detalhe da tarefa |

---

## 9. Command Palette (⌘K)

> **Componente 21st.dev:** `Command Palette` (similaridade 0.359) — busca fuzzy
> **Dependência:** `cmdk`

```
┌─ ⌘K ────────────────────────────────────────────┐
│ 🔍 Buscar tarefas, pessoas, ações...             │
├──────────────────────────────────────────────────┤
│ AÇÕES RÁPIDAS                                     │
│   📋 Criar nova tarefa                 Ctrl+N     │
│   💬 Nova conversa                     Ctrl+M     │
│   👥 Criar grupo                                  │
│                                                   │
│ TAREFAS RECENTES                                  │
│   🔴 Confirmar retornos da semana      → João     │
│   🟡 Organizar prontuários             → Maria    │
│                                                   │
│ PESSOAS                                           │
│   👤 João Santos                       ● Online   │
│   👤 Maria Silva                       ● Online   │
│                                                   │
│ NAVEGAÇÃO                                         │
│   📋 Ir para Kanban                    G K        │
│   📝 Ir para Lista                     G L        │
│   💬 Ir para Chat                      G C        │
│   📊 Ir para Dashboard                 G D        │
│                                                   │
│ CLARA (IA)                                        │
│   🤖 Perguntar para Clara...                      │
└──────────────────────────────────────────────────┘
```

**Categorias e ações:**

| Categoria | Items | Ação ao selecionar |
|-----------|-------|--------------------|
| Ações Rápidas | Criar tarefa, Nova conversa, Criar grupo | Executa ação / abre modal |
| Tarefas Recentes | 5 últimas tarefas acessadas | Abre modal detalhe |
| Pessoas | Membros da equipe | Abre perfil ou inicia conversa |
| Navegação | Páginas do módulo | Navega para a rota |
| Clara (IA) | Input livre | Envia prompt para Clara |

**Atalhos de teclado globais:**

| Atalho | Ação |
|--------|------|
| `⌘K` / `Ctrl+K` | Abre Command Palette |
| `Ctrl+N` | Criar nova tarefa |
| `Ctrl+M` | Nova mensagem/conversa |
| `G` → `K` | Ir para Kanban (chord) |
| `G` → `L` | Ir para Lista |
| `G` → `C` | Ir para Chat |
| `G` → `D` | Ir para Dashboard |
| `Escape` | Fecha modal/palette/painel |

---

## 10. Sistema de Notificações

### 10.1 Toast Notifications

> **Componente 21st.dev:** `Toast (Sonner + Motion)` — 4 variantes, posicionamento

| Evento | Tipo Toast | Mensagem | Ação no toast |
|--------|-----------|----------|---------------|
| Tarefa atribuída a mim | `default` | "📋 João atribuiu 'Confirmar retornos' a você" | [Ver tarefa] |
| Tarefa concluída | `success` | "✅ 'Organizar prontuários' concluída por Maria" | [Ver] |
| Tarefa atrasada | `warning` | "⏰ 'Enviar relatório' venceu há 1 dia" | [Ver tarefa] |
| Nova mensagem | `default` | "💬 João: 'Pessoal, precisa confirmar...'" | [Abrir chat] |
| Menção (@) | `default` | "👋 Maria mencionou você no grupo 'Recepção'" | [Ver mensagem] |
| Clara completou ação | `success` | "🤖 Clara criou 12 tarefas no Kanban" | [Ver tarefas] |
| Erro | `error` | "❌ Não foi possível mover a tarefa" | [Tentar novamente] |

### 10.2 Notification Bell

> **Componente 21st.dev:** `Notifications` — Popover com lista

Localização: TopBar (já existente)

```
┌─ 🔔 Notificações (5) ──────────────────────────┐
│ [Todas] [Não lidas]                    [✓ Tudo] │
├──────────────────────────────────────────────────┤
│ ● 📋 João atribuiu tarefa a você       há 5min  │
│   "Confirmar retornos da semana"                 │
│                                                  │
│ ● 💬 Maria mencionou você              há 15min │
│   no grupo "Recepção"                            │
│                                                  │
│ ● 🤖 Clara completou análise           há 30min │
│   "12 retornos identificados"                    │
│                                                  │
│ ○ ✅ Ana concluiu tarefa               há 1h    │
│   "Organizar prontuários"                        │
│                                                  │
│ ○ ⏰ Prazo se aproximando              há 2h    │
│   "Enviar relatório" vence amanhã                │
├──────────────────────────────────────────────────┤
│ [Ver todas as notificações]                      │
└──────────────────────────────────────────────────┘
```

| Elemento | Ação |
|----------|------|
| Badge counter | Número de não lidas |
| Tab Todas/Não lidas | Filtra notificações |
| ✓ Marcar tudo como lido | Zera counter |
| Item clicável | Navega para o contexto (tarefa/chat/etc) |
| Dot `●` azul | Indica não lida |
| Ver todas | Navega para página de notificações |

---

## 11. Componentes 21st.dev Mapeados

### Tabela Consolidada de Componentes

| # | Componente 21st.dev | Onde Usar | Similaridade | Dependência Principal |
|---|---------------------|-----------|-------------|----------------------|
| 1 | **Filters** (Linear style) | Toolbar Kanban/Lista | 4.617 | `cmdk`, `@radix-ui/react-popover` |
| 2 | **Dropdown Menu** (Rich) | Menu ⋯ de cards/rows | 2.496 | `@radix-ui/react-dropdown-menu` |
| 3 | **Popover** (tooltip-like) | Tooltips, info contextual | 1.975 | `@radix-ui/react-popover` |
| 4 | **Sidebar Component** | Sidebar de navegação | 1.922 | `lucide-react` |
| 5 | **Toast (Sonner + Motion)** | Notificações globais | 1.468 | `sonner`, `framer-motion` |
| 6 | **Animated Loading Skeleton** | Loading states | 0.791 | — (CSS puro) |
| 7 | **Combined Featured Section** | Dashboard bento grid | 0.616 | `recharts` |
| 8 | **Calendar [React-Aria]** | View calendário | 0.518 | `react-aria-components` |
| 9 | **Interactive Empty State** | Estados vazios | 0.485 | `framer-motion` |
| 10 | **Command Palette** | ⌘K busca global | 0.359 | `cmdk` |
| 11 | **Chat Interface** | Base do chat | 0.347 | `motion/react` |
| 12 | **Line Charts 6** | Gráficos dashboard | 0.336 | `recharts` |
| 13 | **Kanban** (DnD Kit) | Board principal | 0.330 | `@dnd-kit/core` |
| 14 | **Messaging Conversation** | Lista de conversas | 0.180 | `@radix-ui/react-*` |
| 15 | **Profile Card** | Sheet de perfil | 0.159 | `lucide-react` |
| 16 | **Tabs** (Multi-variant) | View switcher | 0.150 | `@radix-ui/react-tabs` |
| 17 | **Stats cards with links** | KPIs do dashboard | 0.124 | `clsx`, `tailwind-merge` |
| 18 | **KPI Card** | Métricas individuais | 0.071 | `lucide-react` |
| 19 | **Status** (dot animado) | Prioridade/Online | 0.070 | `class-variance-authority` |
| 20 | **Label Badges** | Tags de categorias | 0.063 | Badge (shadcn) |
| 21 | **Emoji Picker** (frimousse) | Reações no chat | — | `frimousse` |
| 22 | **File Upload** (motion) | Upload no chat | — | `motion/react` |
| 23 | **Chat Input** (composable) | Input de mensagem | — | custom hook |
| 24 | **User Avatars** (empilhados) | Grupo de participantes | — | `motion/react` |
| 25 | **Avatar (ReUI)** com Status | Presença online | — | `class-variance-authority` |
| 26 | **Reddit Nested Thread** | Threads de resposta | — | `@radix-ui/react-*` |
| 27 | **responsive-modal** | Modais (desktop+mobile) | 0.034 | `vaul`, `@radix-ui/react-dialog` |
| 28 | **Data Grid Table** | View de lista | 0.206 | `@radix-ui/react-*`, `cmdk` |
| 29 | **Notifications** (Popover) | Bell na TopBar | 0.029 | `@radix-ui/react-popover` |
| 30 | **Breadcrumb** (shadcn) | Navegação hierárquica | 0.098 | `@radix-ui/react-slot` |
| 31 | **Progress** (Ark UI) | Barra de checklist | 0.107 | `@ark-ui/react` |
| 32 | **Prompt Input** (autocomplete) | @menções no chat | — | `@radix-ui/react-tooltip` |
| 33 | **Animated AI Chat** (TypingDots) | Indicador digitando | — | `framer-motion` |

---

## 12. Dependências Necessárias

### Já existem no projeto (✅):
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `framer-motion`
- `lucide-react`
- `recharts`
- `date-fns`
- `react-aria-components`
- `@internationalized/date`
- `@radix-ui/react-icons`
- `tailwind-merge`
- `emoji-picker-react` (alternativa ao frimousse)

### Precisam instalar (📦):
| Pacote | Motivo | Usado em |
|--------|--------|----------|
| `cmdk` | Command Palette + Filters | ⌘K, Toolbar de filtros |
| `sonner` | Sistema de toasts | Notificações globais |
| `vaul` | Drawer mobile | responsive-modal |
| `frimousse` | Emoji picker leve | Reações no chat |
| `@ark-ui/react` | Progress bar | Checklist nas tarefas |
| `class-variance-authority` | Variantes de componentes | Múltiplos componentes |

**Comando de instalação:**
```bash
npm install cmdk sonner vaul frimousse @ark-ui/react class-variance-authority
```

---

## 13. Estrutura de Arquivos

```
src/
├── app/
│   └── gestao/
│       ├── layout.tsx              ← Layout com sidebar de gestão
│       ├── page.tsx                ← Kanban Board (default)
│       ├── lista/
│       │   └── page.tsx            ← View de Lista/Tabela
│       ├── calendario/
│       │   └── page.tsx            ← View de Calendário
│       ├── chat/
│       │   ├── page.tsx            ← Chat Interno (full page)
│       │   └── [conversationId]/
│       │       └── page.tsx        ← Conversa específica
│       └── dashboard/
│           └── page.tsx            ← Dashboard de Produtividade
│
├── components/
│   └── gestao/
│       ├── layout/
│       │   ├── GestaoSidebar.tsx       ← Sidebar de navegação
│       │   ├── GestaoToolbar.tsx        ← Toolbar com filtros e busca
│       │   └── ViewTabs.tsx             ← Tabs Kanban/Lista/Calendário
│       │
│       ├── kanban/
│       │   ├── KanbanBoard.tsx          ← Board principal (DnD Kit)
│       │   ├── KanbanColumn.tsx         ← Coluna individual
│       │   ├── KanbanCard.tsx           ← Card de tarefa
│       │   ├── KanbanColumnHeader.tsx   ← Header da coluna
│       │   └── KanbanDragOverlay.tsx    ← Overlay durante drag
│       │
│       ├── list/
│       │   ├── TaskTable.tsx            ← Tabela de tarefas
│       │   ├── TaskTableRow.tsx         ← Row individual
│       │   ├── TaskTableHeader.tsx      ← Header sortável
│       │   └── BulkActions.tsx          ← Ações em lote
│       │
│       ├── calendar/
│       │   ├── TaskCalendar.tsx         ← Calendário de tarefas
│       │   └── CalendarDayPopover.tsx   ← Popover ao clicar no dia
│       │
│       ├── chat/
│       │   ├── ChatLayout.tsx           ← Layout 2 painéis
│       │   ├── ConversationList.tsx     ← Lista de conversas (esquerda)
│       │   ├── ConversationItem.tsx     ← Item individual na lista
│       │   ├── ChatThread.tsx           ← Área de mensagens (centro)
│       │   ├── MessageBubble.tsx        ← Bolha de mensagem
│       │   ├── ClaraMessage.tsx         ← Mensagem da Clara (especial)
│       │   ├── ChatInput.tsx            ← Input com ações
│       │   ├── MentionAutocomplete.tsx  ← Autocomplete de @menções
│       │   ├── ThreadPanel.tsx          ← Painel lateral de thread
│       │   ├── GroupInfoPanel.tsx       ← Painel info do grupo
│       │   ├── EmojiReactions.tsx       ← Reações em mensagens
│       │   └── TypingIndicator.tsx      ← Indicador "digitando..."
│       │
│       ├── dashboard/
│       │   ├── DashboardGrid.tsx        ← Layout bento grid
│       │   ├── KPICards.tsx             ← 4 cards de KPI
│       │   ├── TaskChart.tsx            ← Gráfico de linha
│       │   ├── WorkloadBar.tsx          ← Workload da equipe
│       │   ├── WeeklyRanking.tsx        ← Ranking semanal
│       │   └── OverdueTasks.tsx         ← Lista de atrasadas
│       │
│       ├── shared/
│       │   ├── UserAvatar.tsx           ← Avatar com status
│       │   ├── AvatarGroup.tsx          ← Avatares empilhados
│       │   ├── PriorityBadge.tsx        ← Badge de prioridade
│       │   ├── LabelTag.tsx             ← Tag de label colorida
│       │   ├── EmptyState.tsx           ← Estado vazio animado
│       │   ├── SkeletonLoaders.tsx      ← Skeletons de loading
│       │   └── CommandPalette.tsx       ← ⌘K Command Palette
│       │
│       └── modals/
│           ├── CreateTaskModal.tsx       ← Modal criar tarefa
│           ├── TaskDetailModal.tsx       ← Modal detalhe tarefa
│           ├── CreateGroupModal.tsx      ← Modal criar grupo
│           └── MemberProfileSheet.tsx   ← Sheet perfil do membro
│
├── contexts/
│   ├── GestaoContext.tsx            ← Estado global do módulo
│   └── TaskFilterContext.tsx        ← Estado dos filtros
│
├── hooks/
│   ├── useGestaoTasks.ts           ← CRUD de tarefas
│   ├── useGestaoChat.ts            ← Lógica do chat
│   ├── useGestaoMembers.ts         ← Membros da equipe
│   ├── useGestaoFilters.ts         ← Filtros e busca
│   ├── useGestaoNotifications.ts   ← Notificações
│   └── useCommandPalette.ts        ← Lógica do ⌘K
│
└── types/
    └── gestao.ts                   ← Interfaces TypeScript
```

---

## 14. Responsividade e Dark Mode

### Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| `< 640px` (mobile) | Sidebar oculta, views em fullscreen, chat em tela cheia, modais viram drawers (vaul) |
| `640-1024px` (tablet) | Sidebar colapsada (ícones), 2 colunas no Kanban visíveis + scroll horizontal |
| `> 1024px` (desktop) | Layout completo, sidebar expandida, todas as colunas visíveis |

### Dark Mode

Segue o sistema já existente no projeto (toggle na TopBar):

| Elemento | Light | Dark |
|----------|-------|------|
| Background | `bg-white` | `bg-[#0b141a]` |
| Cards | `bg-white border-gray-200` | `bg-[#1a2730] border-gray-700` |
| Texto primário | `text-gray-900` | `text-gray-100` |
| Texto secundário | `text-gray-500` | `text-gray-400` |
| Sidebar | `bg-gray-50` | `bg-[#111b21]` |
| Hover | `hover:bg-gray-100` | `hover:bg-[#2a3942]` |
| Bordas | `border-gray-200` | `border-gray-700` |
| Input | `bg-white border-gray-300` | `bg-[#1a2730] border-gray-600` |

---

## Próximos Passos

- **Fase 2:** PRD do Backend (tabelas, APIs, Realtime, RLS)
- **Fase 3:** Execução (implementação componente a componente)

---

> Documento gerado com pesquisa em 33 componentes do 21st.dev MCP
> Referências: ClickUp, Linear, Monday.com, Notion, Slack, Asana, Dock Health
