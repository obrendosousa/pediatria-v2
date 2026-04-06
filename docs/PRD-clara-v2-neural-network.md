# PRD: Clara v2 - Rede Neural da Clinica Alianca

**Versao:** 2.0  
**Data:** 2026-04-02  
**Autor:** Brendo (CEO) + Claude  
**Status:** Draft  

---

## 1. Visao Geral

### 1.1 O que e

Uma rede neural completa de agentes de IA que otimiza a Clinica Alianca de ponta a ponta. Cada setor da clinica tera um "agente funcionario" dedicado que monitora, analisa e reporta continuamente. Um agente global (CEO Agent) coordena todos os outros e responde perguntas complexas que cruzam dados de multiplos setores.

### 1.2 Principio Arquitetural

Baseado na arquitetura de Orquestracao Multiagente do Claude Code (Coordinator Mode):

- **Coordinator** orquestra, NAO executa
- **Workers** executam, NAO orquestram
- **Workers nao podem criar outros workers** (sem recursao infinita)
- **Comunicacao via TaskStore + resultados estruturados**
- **4 fases por tarefa:** Research -> Synthesis -> Implementation -> Verification

### 1.3 Analogia

```
CLAUDE CODE                    CLINICA ALIANCA
-----------                    ---------------
Coordinator Mode        ->     CEO Agent (Clara Global)
Worker Agents           ->     Agentes Setoriais (Funcionarios)
Agent Tool (spawn)      ->     dispatch_worker() 
TaskStore               ->     clara_tasks (Supabase)
SendMessage/Inbox       ->     clara_agent_messages (Supabase)
autoDream               ->     Ciclo de Consolidacao de Memoria
Penguin Mode            ->     Modo Rapido (Flash Lite para tarefas simples)
System Prompt Layers    ->     Prompt dinamico por agente + contexto setorial
```

---

## 2. Arquitetura dos Agentes

### 2.1 Mapa da Rede Neural

```
                          ┌─────────────────────────────┐
                          │     CEO AGENT (Clara Global) │
                          │     Modelo: Gemini Pro       │
                          │     Role: Coordinator        │
                          │     Acesso: TODOS os dados   │
                          └──────────────┬──────────────┘
                                         │
                    ┌────────────────────┬┴───────────────────┐
                    │                    │                     │
          ┌─────────┴─────────┐ ┌───────┴────────┐ ┌────────┴─────────┐
          │  AGENTES CLINICOS │ │ AGENTES NEGOCIOS│ │ AGENTES SUPORTE  │
          └─────────┬─────────┘ └───────┬────────┘ └────────┬─────────┘
                    │                    │                     │
        ┌───────────┼──────────┐    ┌───┼────┐          ┌────┼────┐
        │           │          │    │        │          │         │
   ┌────┴───┐ ┌────┴───┐ ┌───┴──┐ │   ┌────┴───┐ ┌───┴────┐ ┌──┴───┐
   │Pediatr.│ │Clin.   │ │Recep.│ │   │Financ. │ │Comerci.│ │Estq. │
   │Agent   │ │Geral   │ │Agent │ │   │Agent   │ │Agent   │ │Agent │
   │        │ │Agent   │ │      │ │   │        │ │        │ │      │
   └────────┘ └────────┘ └──────┘ │   └────────┘ └────────┘ └──────┘
                                   │
                              ┌────┴───┐
                              │RH/Ops  │
                              │Agent   │
                              └────────┘
```

### 2.2 Definicao dos Agentes

#### CEO Agent (Clara Global) — COORDINATOR

| Propriedade | Valor |
|---|---|
| **ID** | `ceo_agent` |
| **Modelo** | Gemini 3.1 Pro (temp 0) |
| **Role** | Coordinator |
| **Acesso** | Todos os schemas, todos os agentes |
| **Contexto** | 1M tokens |
| **Quem usa** | CEO, Diretoria |

**Ferramentas exclusivas (Coordinator-Only):**
- `dispatch_worker` — Spawna agentes setoriais com prompts self-contained
- `read_agent_report` — Le relatorios de qualquer agente
- `send_directive` — Envia diretivas para agentes setoriais
- `aggregate_results` — Agrega resultados de multiplos workers
- `manage_tasks` — Cria, rastreia e cancela tasks

**Ferramentas PROIBIDAS (Coordinator-Banned):**
- `execute_sql` — Nao consulta banco diretamente (delega)
- `analyze_raw_conversations` — Nao analisa dados brutos (delega)

**Exemplo de uso:**
```
CEO: "Por que a margem de lucro caiu esse mes?"

CEO Agent:
  1. dispatch_worker(financeiro_agent, "Levantar receitas e despesas de marco vs fevereiro")
  2. dispatch_worker(comercial_agent, "Analisar taxa de conversao e ticket medio de marco")
  3. dispatch_worker(pediatria_agent, "Verificar volume de consultas pediatricas em marco")
  4. [SYNTHESIS] Cruza os 3 resultados
  5. dispatch_worker(financeiro_agent, "Verificar: receita caiu 12% mas custos subiram 8%?")
  6. [FINAL REPORT] "A margem caiu porque..."
```

---

#### Pediatria Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `pediatria_agent` |
| **Modelo** | Gemini 3.1 Flash (temp 0.1) |
| **Role** | Worker |
| **Schema** | `public` + `atendimento` (filtro: procedimentos pediatricos) |
| **Quem usa** | CEO Agent (delegacao), Pediatras (direto) |

**Ferramentas:**
- `execute_sql` — Queries no schema atendimento (procedures pediatricas)
- `get_appointment_metrics` — Metricas de consultas pediatricas
- `analyze_growth_data` — Analise de curvas de crescimento (anthropometry)
- `get_patient_history` — Historico de pacientes pediatricos
- `read_clinical_protocols` — Protocolos clinicos pediatricos
- `save_report` — Salvar relatorio setorial
- `vault_read` / `vault_search` — Buscar no knowledge base

**Ferramentas PROIBIDAS (Worker-Banned):**
- `dispatch_worker` — Nao pode criar sub-agentes
- `send_directive` — Nao pode dar ordens a outros agentes
- `ask_user_question` — Nao pode interagir diretamente com CEO (so retorna resultado)

**Analises automaticas:**
- **Diaria:** Volume de consultas, faltas, retornos agendados
- **Semanal:** Curvas de crescimento com desvios, protocolos mais usados
- **Mensal:** Taxa de retorno, satisfacao, comparativo com mes anterior

---

#### Clinica Geral Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `clinica_geral_agent` |
| **Modelo** | Gemini 3.1 Flash (temp 0.1) |
| **Role** | Worker |
| **Schema** | `public` + `atendimento` (filtro: procedimentos nao-pediatricos) |
| **Quem usa** | CEO Agent, Medicos clinicos |

**Ferramentas:**
- `execute_sql` — Queries no schema atendimento
- `get_appointment_metrics` — Metricas de consultas gerais
- `analyze_clinical_evolutions` — Analise de evolucoes clinicas
- `get_procedure_stats` — Estatisticas de procedimentos
- `read_clinical_protocols` — Protocolos da clinica geral
- `save_report` / `vault_read` / `vault_search`

**Analises automaticas:**
- **Diaria:** Consultas realizadas, cancelamentos, procedimentos
- **Semanal:** Tempo medio de consulta, taxa de retorno
- **Mensal:** Produtividade por profissional, mix de procedimentos

---

#### Recepcao Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `recepcao_agent` |
| **Modelo** | Gemini 3.1 Flash (temp 0.1) |
| **Role** | Worker |
| **Schema** | `public` (chats, chat_messages, appointments, funnels) |
| **Quem usa** | CEO Agent, Recepcionistas |

**Ferramentas:**
- `execute_sql` — Queries em chats e agendamentos
- `analyze_raw_conversations` — Analise qualitativa de conversas WhatsApp
- `get_funnel_metrics` — Metricas do funil de vendas
- `get_response_time_stats` — Tempo de resposta da recepcao
- `get_chat_volume` — Volume de mensagens por periodo
- `save_report` / `vault_read` / `vault_search`

**Analises automaticas:**
- **Diaria:** Tempo medio de resposta, conversas sem resposta, objecoes do dia
- **Semanal:** Taxa de conversao do funil, motivos de perda, horarios de pico
- **Mensal:** NPS estimado, padroes de objecao, eficiencia da recepcao

---

#### Financeiro Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `financeiro_agent` |
| **Modelo** | Gemini 3.1 Flash (temp 0.1) |
| **Role** | Worker |
| **Schema** | `public` (financial_transactions, sales, medical_checkouts, daily_closures) |
| **Quem usa** | CEO Agent, Financeiro |

**Ferramentas:**
- `execute_sql` — Queries financeiras
- `get_revenue_metrics` — Receitas por periodo, origem, metodo de pagamento
- `get_expense_analysis` — Analise de custos
- `get_daily_closure_data` — Dados de fechamento diario
- `get_ticket_medio` — Ticket medio por tipo de servico
- `compare_periods` — Comparativo entre periodos
- `save_report` / `vault_read` / `vault_search`

**Analises automaticas:**
- **Diaria:** Receita do dia, metodos de pagamento, fechamento de caixa
- **Semanal:** Fluxo de caixa, inadimplencia, receita por profissional
- **Mensal:** DRE simplificado, margem por servico, tendencias, projecao

---

#### Comercial Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `comercial_agent` |
| **Modelo** | Gemini 3.1 Flash (temp 0.1) |
| **Role** | Worker |
| **Schema** | `public` (chats, appointments, funnels, automation_rules) |
| **Quem usa** | CEO Agent, Marketing |

**Ferramentas:**
- `execute_sql` — Queries comerciais
- `get_conversion_funnel` — Funil completo: lead -> agendamento -> consulta
- `analyze_objections` — Classificacao de objecoes (preco, agenda, etc)
- `get_acquisition_channels` — Canais de aquisicao de pacientes
- `get_retention_metrics` — Retencao e churn de pacientes
- `analyze_automation_performance` — Performance das automacoes
- `save_report` / `vault_read` / `vault_search`

**Analises automaticas:**
- **Diaria:** Leads novos, agendamentos, taxa de no-show
- **Semanal:** Funil de conversao, CAC estimado, LTV por canal
- **Mensal:** ROI de marketing, sazonalidade, oportunidades de cross-sell

---

#### Estoque Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `estoque_agent` |
| **Modelo** | Gemini 3.1 Flash Lite (temp 0.1) |
| **Role** | Worker |
| **Schema** | `public` (products, stock_movements_ledger, sales, sale_items) |
| **Quem usa** | CEO Agent, Loja |

**Ferramentas:**
- `execute_sql` — Queries de estoque
- `get_stock_levels` — Niveis de estoque atual
- `get_product_turnover` — Giro de produtos
- `detect_low_stock` — Alerta de estoque baixo
- `get_sales_by_product` — Vendas por produto
- `save_report` / `vault_read` / `vault_search`

**Analises automaticas:**
- **Diaria:** Produtos vendidos, estoque critico
- **Semanal:** Giro de estoque, produtos parados
- **Mensal:** ABC analysis, sugestao de reposicao, margem por produto

---

#### RH/Ops Agent — WORKER

| Propriedade | Valor |
|---|---|
| **ID** | `rh_ops_agent` |
| **Modelo** | Gemini 3.1 Flash Lite (temp 0.1) |
| **Role** | Worker |
| **Schema** | `atendimento` (collaborators, professionals, doctor_schedules) |
| **Quem usa** | CEO Agent, RH |

**Ferramentas:**
- `execute_sql` — Queries de RH
- `get_schedule_utilization` — Taxa de ocupacao das agendas
- `get_staff_productivity` — Produtividade por profissional
- `get_attendance_patterns` — Padroes de atendimento
- `save_report` / `vault_read` / `vault_search`

**Analises automaticas:**
- **Diaria:** Ocupacao das agendas, horarios vagos
- **Semanal:** Produtividade por profissional, atrasos
- **Mensal:** Carga de trabalho, sugestoes de otimizacao de agenda

---

## 3. Arquitetura Tecnica

### 3.1 System Prompt Architecture

Baseado na arquitetura de 2 zonas do Claude Code:

```
┌─────────────────────────────────────────────────────────┐
│                    ZONA ESTATICA                         │
│              (cacheable, igual para todos)                │
│                                                          │
│  1. IDENTIDADE                                           │
│     "Voce e o [nome_agente], um agente de IA             │
│      especializado em [setor] da Clinica Alianca."       │
│                                                          │
│  2. CAPACIDADES E RESTRICOES                             │
│     - Lista de ferramentas disponiveis                   │
│     - Lista de ferramentas PROIBIDAS                     │
│     - Limites de iteracao e tokens                       │
│                                                          │
│  3. REGRAS DE COMPORTAMENTO                              │
│     - Nunca inventar dados                               │
│     - Sempre citar fonte (tabela, query, chat_id)        │
│     - Usar formato estruturado (JSON) para outputs       │
│     - Respeitar LGPD (sem PII em relatorios)             │
│                                                          │
│  4. MODO DE OPERACAO                                     │
│     [COORDINATOR]: Orquestre workers, nao execute         │
│     [WORKER]: Execute a tarefa, retorne resultado         │
│                                                          │
│  5. OUTPUT STYLE                                         │
│     - Conciso para workers (JSON estruturado)            │
│     - Narrativo para coordinator (relatorio CEO)         │
│                                                          │
│ ═══ __DYNAMIC_BOUNDARY__ ═══                             │
│                                                          │
│                    ZONA DINAMICA                          │
│             (muda por sessao/turno/agente)                │
│                                                          │
│  6. CONTEXTO TEMPORAL                                    │
│     - Data atual, fuso BRT                               │
│     - Periodo de referencia da pergunta                  │
│                                                          │
│  7. BRAIN FILES (agent_config)                           │
│     - Regras de negocio da clinica                       │
│     - Protocolos clinicos ativos                         │
│     - Configuracoes especificas do setor                 │
│                                                          │
│  8. MEMORIAS RELEVANTES                                  │
│     - Top 5 memorias do vault (por similaridade)         │
│     - Relatorios recentes do setor                       │
│                                                          │
│  9. DB STATS                                             │
│     - Totais de registros relevantes                     │
│     - Data do ultimo dado disponivel                     │
│                                                          │
│  10. CONTEXTO DA TASK (se worker)                        │
│      - Task ID, descricao, parametros                    │
│      - Dados pre-computados pelo coordinator             │
│      - Schema de output esperado (Zod)                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Modo Rapido (Penguin Mode Adaptado)

Inspirado no Penguin Mode do Claude Code:

| Modo | Modelo | Uso | Trigger |
|---|---|---|---|
| **Normal** | Gemini 3.1 Pro | Perguntas complexas do CEO, analises cross-setor | Default para CEO Agent |
| **Rapido** | Gemini 3.1 Flash | Perguntas simples, lookups, metricas diretas | Auto-detectado ou toggle manual |
| **Ultra-rapido** | Gemini 3.1 Flash Lite | Classificacao, roteamento, extracoes simples | Workers em batch |

**Logica de selecao automatica:**

```typescript
function selectModel(query: string, agentRole: AgentRole): ModelConfig {
  // Coordinator sempre usa Pro para sintese
  if (agentRole === 'coordinator') {
    const isSimple = detectSimpleQuery(query); // regex + keyword
    return isSimple
      ? { model: 'gemini-3.1-flash-preview', effort: 'low' }
      : { model: 'gemini-3.1-pro-preview', effort: 'high' };
  }
  
  // Workers usam Flash por default
  // Flash Lite para tarefas de classificacao/extracao batch
  if (agentRole === 'worker') {
    const isBatchClassification = detectBatchTask(query);
    return isBatchClassification
      ? { model: 'gemini-3.1-flash-lite-preview', effort: 'low' }
      : { model: 'gemini-3.1-flash-preview', effort: 'medium' };
  }
}
```

**Effort Levels (adaptado do Claude Code):**

| Level | Thinking Budget | Temperatura | Uso |
|---|---|---|---|
| **Low** | 0 (sem reasoning) | 0.0 | Classificacao, roteamento, lookups |
| **Medium** | 5,000 tokens | 0.1 | Analise de dados, queries complexas |
| **High** | 10,000 tokens | 0.0 | Sintese cross-setor, relatorios estrategicos |

### 3.3 Tool Segregation

```typescript
// tool_registry.ts

export const TOOL_PERMISSIONS = {
  // === COORDINATOR-ONLY (CEO Agent) ===
  coordinator_only: [
    'dispatch_worker',        // Spawnar agentes setoriais
    'read_agent_report',      // Ler relatorios de qualquer agente
    'send_directive',         // Enviar diretivas
    'aggregate_results',      // Agregar resultados de workers
    'manage_tasks',           // CRUD de tasks
    'ask_user_question',      // Unico que fala com o usuario
    'generate_deep_report',   // Relatorio executivo final
  ],

  // === COORDINATOR-BANNED ===
  coordinator_banned: [
    'execute_sql',                 // Delega para workers
    'analyze_raw_conversations',   // Delega para workers
    'get_volume_metrics',          // Delega para workers
  ],

  // === WORKER TOOLS (por setor) ===
  worker_common: [
    'execute_sql',            // Queries SQL (SELECT only, LIMIT 500)
    'save_report',            // Salvar relatorio do setor
    'vault_read',             // Ler knowledge base
    'vault_search',           // Buscar no vault
    'vault_semantic_search',  // Busca semantica
    'read_brain_files',       // Ler regras do setor
    'vault_write_memory',     // Gravar aprendizados
    'vault_log_decision',     // Log de decisoes
  ],

  worker_clinical: [
    'get_appointment_metrics',
    'get_patient_history',
    'read_clinical_protocols',
    'analyze_clinical_evolutions',
    'get_procedure_stats',
    'analyze_growth_data',
  ],

  worker_financial: [
    'get_revenue_metrics',
    'get_expense_analysis',
    'get_daily_closure_data',
    'get_ticket_medio',
    'compare_periods',
  ],

  worker_commercial: [
    'get_conversion_funnel',
    'analyze_objections',
    'analyze_raw_conversations',
    'get_acquisition_channels',
    'get_retention_metrics',
    'analyze_automation_performance',
    'get_funnel_metrics',
    'get_response_time_stats',
  ],

  worker_inventory: [
    'get_stock_levels',
    'get_product_turnover',
    'detect_low_stock',
    'get_sales_by_product',
  ],

  worker_hr: [
    'get_schedule_utilization',
    'get_staff_productivity',
    'get_attendance_patterns',
  ],

  // === WORKER-BANNED ===
  worker_banned: [
    'dispatch_worker',        // Nao pode criar sub-agentes
    'send_directive',         // Nao pode dar ordens
    'ask_user_question',      // Nao pode falar com usuario
    'manage_tasks',           // Nao pode gerenciar tasks de outros
    'generate_deep_report',   // So coordinator gera report final
  ],
} as const;
```

### 3.4 TaskStore (Persistente no Supabase)

Diferente do Claude Code (DashMap in-memory), usamos Supabase porque nossos agentes rodam em serverless:

```sql
-- Tabela: clara_tasks
CREATE TABLE clara_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificacao
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  agent_id TEXT NOT NULL,             -- 'ceo_agent', 'financeiro_agent', etc
  parent_task_id UUID REFERENCES clara_tasks(id),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  
  -- Dependencias
  blocked_by UUID[] DEFAULT '{}',     -- Tasks que precisam completar antes
  blocks UUID[] DEFAULT '{}',         -- Tasks que esta bloqueia
  
  -- Input/Output
  input_params JSONB,                 -- Parametros para o worker
  output_data JSONB,                  -- Resultado estruturado do worker
  output_schema TEXT,                 -- Nome do Zod schema esperado
  error_message TEXT,
  
  -- Metricas
  token_usage INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  model_used TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Controle
  max_retries INTEGER DEFAULT 2,
  retry_count INTEGER DEFAULT 0,
  timeout_ms INTEGER DEFAULT 120000   -- 2 minutos default
);

CREATE INDEX idx_clara_tasks_status ON clara_tasks(status);
CREATE INDEX idx_clara_tasks_agent ON clara_tasks(agent_id);
CREATE INDEX idx_clara_tasks_parent ON clara_tasks(parent_task_id);
```

### 3.5 Agent Messages (Comunicacao Inter-Agente)

```sql
-- Tabela: clara_agent_messages
CREATE TABLE clara_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,             -- agent_id ou '*' para broadcast
  task_id UUID REFERENCES clara_tasks(id),
  message_type TEXT NOT NULL
    CHECK (message_type IN ('directive','result','error','status_update')),
  content JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_messages_to ON clara_agent_messages(to_agent, read_at);
```

### 3.6 Agent Reports (Relatorios Setoriais)

```sql
-- Tabela: clara_agent_reports
CREATE TABLE clara_agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  report_type TEXT NOT NULL
    CHECK (report_type IN ('daily','weekly','monthly','on_demand')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Conteudo
  title TEXT NOT NULL,
  summary TEXT NOT NULL,              -- Resumo executivo (max 500 chars)
  content_markdown TEXT NOT NULL,     -- Relatorio completo
  structured_data JSONB NOT NULL,     -- Dados estruturados para agregacao
  
  -- Qualidade
  data_sources TEXT[],                -- Tabelas consultadas
  confidence_score REAL,              -- 0-1
  
  -- Metadata
  model_used TEXT,
  token_usage INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_reports_agent_type ON clara_agent_reports(agent_id, report_type);
CREATE INDEX idx_agent_reports_period ON clara_agent_reports(period_start, period_end);
```

---

## 4. Sistema de Sonho (autoDream Adaptado)

### 4.1 Conceito

Baseado no Dream System do Claude Code. Cada agente "sonha" periodicamente — um processo background que consolida o que aprendeu em memorias duraveis.

### 4.2 Triggers (Sistema de 3 Gates)

```typescript
interface DreamConfig {
  min_hours: number;      // Horas minimas entre sonhos
  min_sessions: number;   // Sessoes minimas desde ultimo sonho
}

const DREAM_CONFIG: Record<string, DreamConfig> = {
  ceo_agent:           { min_hours: 24, min_sessions: 3 },
  pediatria_agent:     { min_hours: 48, min_sessions: 5 },
  clinica_geral_agent: { min_hours: 48, min_sessions: 5 },
  recepcao_agent:      { min_hours: 24, min_sessions: 10 },  // Mais ativo
  financeiro_agent:    { min_hours: 24, min_sessions: 3 },
  comercial_agent:     { min_hours: 24, min_sessions: 5 },
  estoque_agent:       { min_hours: 72, min_sessions: 3 },   // Menos ativo
  rh_ops_agent:        { min_hours: 72, min_sessions: 3 },
};
```

**3 Gates (avaliados do mais barato ao mais caro):**

1. **Time Gate:** `horas_desde_ultimo_sonho >= min_hours`
2. **Session Gate:** `sessoes_desde_ultimo_sonho >= min_sessions`
3. **Lock Gate:** Nenhum outro sonho em andamento (lock file com staleness de 1h)

### 4.3 As 4 Fases do Sonho

```
FASE 1 — ORIENT (Orientacao)
  - Ler MEMORY.md do vault do agente
  - Ler memorias existentes do agente no clara_memories
  - Entender o que ja sabe, evitar duplicatas

FASE 2 — GATHER SIGNAL (Coletar Sinais)
  - Ler relatorios recentes do agente (clara_agent_reports)
  - Verificar memorias que contradizem dados atuais
  - Buscar padroes nos logs de decisao (vault_log_decision)
  - NAO ler conversas inteiras; buscar termos especificos

FASE 3 — CONSOLIDATE (Consolidar)
  - Criar/atualizar memorias no vault e clara_memories
  - Converter datas relativas em absolutas
  - Deletar fatos contraditos
  - Mesclar memorias redundantes

FASE 4 — PRUNE (Podar)
  - Manter MEMORY.md abaixo de 200 linhas
  - Remover ponteiros para memorias obsoletas
  - Encurtar entries verbosos
  - Resolver contradicoes
```

### 4.4 Implementacao

```typescript
// dream_system.ts

interface ConsolidationState {
  last_consolidated_at: number | null;  // Unix timestamp
  agent_id: string;
}

async function shouldDream(agentId: string): Promise<boolean> {
  const config = DREAM_CONFIG[agentId];
  const state = await loadConsolidationState(agentId);
  
  // Gate 1: Time (mais barato - uma operacao aritmetica)
  if (state.last_consolidated_at) {
    const hoursElapsed = (Date.now() - state.last_consolidated_at) / 3_600_000;
    if (hoursElapsed < config.min_hours) return false;
  }
  
  // Gate 2: Sessions (scan no banco)
  const sessionCount = await countSessionsSince(agentId, state.last_consolidated_at);
  if (sessionCount < config.min_sessions) return false;
  
  // Gate 3: Lock (verificar se outro sonho esta rodando)
  const lockAge = await getLockAge(agentId);
  if (lockAge !== null && lockAge < 3_600_000) return false; // <1h = ativo
  
  return true;
}

async function executeDream(agentId: string): Promise<void> {
  await acquireLock(agentId);
  
  try {
    const dreamPrompt = buildDreamPrompt(agentId);
    
    // Spawna um sub-agente read-only para o sonho
    await dreamGraph.invoke({
      agent_id: agentId,
      messages: [new SystemMessage(dreamPrompt)],
      tools: READ_ONLY_TOOLS,  // Sem escrita exceto no vault
    });
    
    await updateConsolidationState(agentId, { last_consolidated_at: Date.now() });
  } finally {
    await releaseLock(agentId);
  }
}
```

### 4.5 Analises Automaticas (Cron-Driven)

```typescript
// scheduled_analyses.ts

const ANALYSIS_SCHEDULE = {
  daily: {
    cron: '0 6 * * *',  // Todo dia as 6h BRT
    agents: ['recepcao_agent', 'financeiro_agent', 'comercial_agent',
             'pediatria_agent', 'clinica_geral_agent', 'estoque_agent'],
    prompt: (agentId: string, date: string) => `
      Gere o relatorio DIARIO de ${date} para o setor ${agentId}.
      Analise os dados do dia anterior.
      Retorne JSON estruturado com:
      - metricas_chave: Record<string, number>
      - destaques: string[] (max 5)
      - alertas: string[] (problemas que precisam atencao)
      - comparativo_dia_anterior: Record<string, {atual: number, anterior: number, variacao_pct: number}>
    `,
  },
  
  weekly: {
    cron: '0 7 * * 1',  // Segunda-feira as 7h
    agents: ['ALL'],
    prompt: (agentId: string, weekStart: string, weekEnd: string) => `
      Gere o relatorio SEMANAL de ${weekStart} a ${weekEnd}.
      Identifique tendencias e pontos de melhoria.
      Retorne JSON com:
      - metricas_semana: Record<string, number>
      - tendencias: Array<{metrica, direcao, variacao_pct}>
      - pontos_melhoria: Array<{area, problema, sugestao, impacto_estimado}>
      - comparativo_semana_anterior: Record<string, number>
    `,
  },
  
  monthly: {
    cron: '0 8 1 * *',  // Dia 1 as 8h
    agents: ['ALL'],
    prompt: (agentId: string, month: string) => `
      Gere o relatorio MENSAL de ${month}.
      Foco em insights estrategicos e recomendacoes.
      Retorne JSON com:
      - resumo_executivo: string (max 300 chars)
      - kpis: Record<string, {valor, meta, atingimento_pct}>
      - insights: Array<{insight, evidencia, recomendacao}>
      - riscos: Array<{risco, probabilidade, impacto, mitigacao}>
      - oportunidades: Array<{oportunidade, potencial_financeiro, proximo_passo}>
    `,
  },
};
```

---

## 5. Fluxo de Dados Completo

### 5.1 Pergunta do CEO (On-Demand)

```
CEO digita: "Por que a margem de lucro caiu esse mes?"
    │
    ▼
┌──────────────────────────────────────────────────┐
│ CEO Agent (Coordinator)                          │
│                                                  │
│ 1. load_context_node                             │
│    ├─ Resolve temporal: "esse mes" → marco 2026  │
│    ├─ Carrega brain files da clinica             │
│    └─ Auto-RAG: memorias relevantes do vault     │
│                                                  │
│ 2. classify_node                                 │
│    → "cross_sector_analysis" (precisa multiplos  │
│       setores: financeiro + comercial + clinico) │
│                                                  │
│ 3. plan_tasks_node                               │
│    Cria tasks no clara_tasks:                    │
│    ├─ T1: financeiro_agent → receitas/despesas   │
│    ├─ T2: comercial_agent → conversao/ticket     │
│    ├─ T3: pediatria_agent → volume consultas     │
│    └─ T4: clinica_geral_agent → volume consultas │
│                                                  │
│ 4. dispatch_workers_node                         │
│    ├─ Worker T1 (parallel)                       │
│    ├─ Worker T2 (parallel)                       │
│    ├─ Worker T3 (parallel)                       │
│    └─ Worker T4 (parallel)                       │
│                                                  │
│    [Espera todos completarem ou timeout 120s]    │
│                                                  │
│ 5. synthesize_node                               │
│    Le output_data de T1-T4 (JSON estruturado)    │
│    Cruza dados programaticamente:                │
│    - Receita caiu 12%                            │
│    - Volume consultas estavel                    │
│    - Ticket medio caiu 15%                       │
│    - Taxa conversao caiu 8%                      │
│                                                  │
│ 6. verify_node (opcional)                        │
│    ├─ T5: financeiro_agent → "Confirma receita   │
│    │       caiu 12%? Query especifica"           │
│    └─ Valida amostra dos dados                   │
│                                                  │
│ 7. final_report_node                             │
│    Gera resposta narrativa para o CEO:           │
│    "A margem caiu por 3 fatores combinados..."   │
│    Com dados, graficos sugeridos, e acoes        │
│                                                  │
└──────────────────────────────────────────────────┘
    │
    ▼
CEO recebe resposta com dados reais e verificados
```

### 5.2 Analise Automatica (Scheduled)

```
CRON: 6h da manha (diario)
    │
    ▼
┌──────────────────────────────────────────────────┐
│ Scheduler                                        │
│                                                  │
│ Para cada agente no schedule:                    │
│ 1. Cria task no clara_tasks                      │
│ 2. Invoca worker graph com prompt de analise     │
│ 3. Worker executa tools, coleta dados            │
│ 4. Worker retorna JSON estruturado               │
│ 5. Salva em clara_agent_reports                  │
│ 6. Se encontrou ALERTA: cria notificacao         │
│                                                  │
└──────────────────────────────────────────────────┘
    │
    ▼
Relatorios disponiveis para CEO Agent consultar
CEO recebe push notification se houver alertas criticos
```

### 5.3 Dados em Tempo Real (Event-Driven)

```
WhatsApp webhook recebe mensagem
    │
    ▼
Ingestion Agent (ja existe)
    ├─ Salva no banco
    ├─ Extrai insights (fire-and-forget)
    └─ Trigger Copilot (se keyword detectada)
    │
    ▼
Os agentes setoriais NAO sao triggerados em tempo real.
Eles consultam os dados quando:
  - Cron de analise automatica roda
  - CEO Agent delega uma task
  - Usuario do setor faz uma pergunta direta
```

---

## 6. Enxame de Agentes (Swarm Mode)

### 6.1 Quando Usar

O CEO Agent pode criar um enxame para tarefas que exigem processamento massivo em paralelo:

```
CEO: "Classifique todas as 10.000 conversas do ultimo trimestre 
      por tipo de objecao e desfecho"
```

### 6.2 Como Funciona

```typescript
// swarm_executor.ts

interface SwarmConfig {
  task_description: string;
  data_query: string;           // Query para buscar os dados
  batch_size: number;           // Conversas por worker
  worker_type: string;          // Tipo de worker (recepcao, comercial, etc)
  output_schema: ZodSchema;     // Schema do output por batch
  max_concurrent: number;       // Workers simultaneos
  aggregation_fn: string;       // Como agregar ('merge_arrays' | 'sum_counts' | 'custom')
}

async function executeSwarm(config: SwarmConfig): Promise<SwarmResult> {
  // 1. Buscar dados totais
  const totalData = await fetchData(config.data_query);
  
  // 2. Dividir em batches
  const batches = chunkArray(totalData, config.batch_size);
  
  // 3. Criar tasks para cada batch
  const tasks = batches.map((batch, i) => createTask({
    subject: `${config.task_description} [batch ${i+1}/${batches.length}]`,
    agent_id: config.worker_type,
    input_params: {
      data: batch,
      output_schema: config.output_schema.shape,
      instructions: config.task_description,
    },
    output_schema: config.output_schema.name,
  }));
  
  // 4. Dispatch com concurrency control
  const results = await pLimit(config.max_concurrent)(
    tasks.map(task => () => executeWorkerForTask(task))
  );
  
  // 5. Agregar resultados programaticamente (NAO via LLM)
  const aggregated = aggregateResults(results, config.aggregation_fn);
  
  // 6. Verificacao por amostragem (5%)
  const sampleSize = Math.ceil(totalData.length * 0.05);
  const verification = await executeVerificationWorker(aggregated, sampleSize);
  
  return {
    data: aggregated,
    verification,
    metadata: {
      total_processed: totalData.length,
      batches: batches.length,
      failed_batches: results.filter(r => r.status === 'failed').length,
      token_usage: results.reduce((sum, r) => sum + r.token_usage, 0),
    },
  };
}
```

### 6.3 Prevencao de Runaway (4 Camadas)

Baseado no Claude Code:

```typescript
interface WorkerSafetyConfig {
  // Camada 1: Limite de iteracoes
  max_iterations: number;         // Default 8 por worker
  
  // Camada 2: Budget de tokens
  max_output_chars: number;       // Default 100,000 chars
  max_tokens_per_turn: number;    // Default 32,000
  
  // Camada 3: Timeout + Cancellation
  timeout_ms: number;             // Default 120,000ms (2 min)
  abort_controller: AbortController;
  
  // Camada 4: Custo maximo
  max_cost_usd: number;           // Default $0.50 por worker
}

// Workers NAO podem:
// - Spawnar outros workers (dispatch_worker excluido das tools)
// - Rodar por mais de max_iterations
// - Produzir output maior que max_output_chars
// - Custar mais que max_cost_usd
// Coordinator pode cancelar qualquer worker a qualquer momento
```

---

## 7. Outputs Estruturados

### 7.1 Principio

Workers SEMPRE retornam JSON estruturado (via Zod schema). Coordinator agrega PROGRAMATICAMENTE. Zero perda de informacao.

### 7.2 Schemas de Output por Tipo

```typescript
// output_schemas.ts

// === WORKER OUTPUTS ===

const DailyReportOutput = z.object({
  agent_id: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  kpis: z.record(z.string(), z.number()),
  highlights: z.array(z.string()).max(5),
  alerts: z.array(z.object({
    severity: z.enum(['info', 'warning', 'critical']),
    message: z.string(),
    metric: z.string(),
    value: z.number(),
    threshold: z.number(),
  })),
  comparisons: z.array(z.object({
    metric: z.string(),
    current: z.number(),
    previous: z.number(),
    change_pct: z.number(),
  })),
});

const ClassificationOutput = z.object({
  classifications: z.array(z.object({
    chat_id: z.number(),
    category: z.string(),
    subcategory: z.string().optional(),
    confidence: z.number().min(0).max(1),
    evidence: z.string().max(200),
  })),
  aggregates: z.object({
    total_processed: z.number(),
    by_category: z.record(z.string(), z.number()),
    avg_confidence: z.number(),
  }),
  errors: z.array(z.string()),
});

const FinancialAnalysisOutput = z.object({
  revenue: z.object({
    total: z.number(),
    by_origin: z.record(z.string(), z.number()),
    by_payment_method: z.record(z.string(), z.number()),
    by_professional: z.record(z.string(), z.number()),
  }),
  expenses: z.object({
    total: z.number(),
    by_category: z.record(z.string(), z.number()),
  }),
  margin: z.object({
    gross: z.number(),
    gross_pct: z.number(),
  }),
  trends: z.array(z.object({
    metric: z.string(),
    direction: z.enum(['up', 'down', 'stable']),
    change_pct: z.number(),
    significance: z.enum(['low', 'medium', 'high']),
  })),
});

// === COORDINATOR AGGREGATION (programatico, sem LLM) ===

function aggregateClassifications(
  workerResults: ClassificationOutput[]
): AggregatedClassification {
  const all = workerResults.flatMap(r => r.classifications);
  const byCategory = groupBy(all, c => c.category);
  
  return {
    total: all.length,
    by_category: Object.fromEntries(
      Object.entries(byCategory).map(([cat, items]) => [
        cat,
        {
          count: items.length,
          pct: (items.length / all.length) * 100,
          avg_confidence: mean(items.map(i => i.confidence)),
          top_examples: items
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5)
            .map(i => ({ chat_id: i.chat_id, evidence: i.evidence })),
        },
      ])
    ),
    failed_batches: workerResults.filter(r => r.errors.length > 0).length,
    total_errors: workerResults.reduce((sum, r) => sum + r.errors.length, 0),
  };
}
```

---

## 8. Grafo LangGraph

### 8.1 CEO Agent Graph (Coordinator)

```typescript
// ceo_graph.ts

const ceoState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
  current_user_role: Annotation<string>(),
  
  // Contexto
  temporal_anchor: Annotation<TemporalAnchor | null>(),
  db_stats: Annotation<DbStats | null>(),
  loaded_context: Annotation<LoadedContext | null>(),
  
  // Task Management
  tasks: Annotation<ClaraTask[]>({ reducer: taskReducer }),
  worker_results: Annotation<Record<string, any>>({ reducer: mergeReducer }),
  
  // Control Flow
  classification: Annotation<'simple' | 'cross_sector' | 'single_sector'>(),
  target_agents: Annotation<string[]>(),
  synthesis_complete: Annotation<boolean>(),
  verification_needed: Annotation<boolean>(),
  iteration: Annotation<number>(),
});

const ceoWorkflow = new StateGraph(ceoState)
  // Nodes
  .addNode('load_context', loadContextNode)
  .addNode('classify', classifyNode)
  .addNode('simple_answer', simpleAnswerNode)
  .addNode('plan_tasks', planTasksNode)
  .addNode('dispatch_workers', dispatchWorkersNode)
  .addNode('wait_results', waitResultsNode)
  .addNode('synthesize', synthesizeNode)
  .addNode('verify', verifyNode)
  .addNode('final_report', finalReportNode)
  
  // Edges
  .addEdge(START, 'load_context')
  .addEdge('load_context', 'classify')
  .addConditionalEdges('classify', (state) => {
    if (state.classification === 'simple') return 'simple_answer';
    return 'plan_tasks';
  })
  .addEdge('simple_answer', END)
  .addEdge('plan_tasks', 'dispatch_workers')
  .addEdge('dispatch_workers', 'wait_results')
  .addEdge('wait_results', 'synthesize')
  .addConditionalEdges('synthesize', (state) => {
    if (state.verification_needed) return 'verify';
    return 'final_report';
  })
  .addEdge('verify', 'final_report')
  .addEdge('final_report', END);
```

### 8.2 Worker Graph (Template para todos os setores)

```typescript
// worker_graph.ts

const workerState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
  task: Annotation<ClaraTask>(),
  agent_config: Annotation<AgentConfig>(),
  iteration: Annotation<number>(),
  result: Annotation<any>(),
});

function createWorkerGraph(agentId: string, tools: StructuredTool[]) {
  return new StateGraph(workerState)
    .addNode('execute', async (state) => {
      const model = selectModel(state.task.description, 'worker');
      const llm = new ChatGoogleGenerativeAI({
        model: model.model,
        temperature: model.temperature,
      }).bindTools(tools);
      
      const systemPrompt = buildWorkerSystemPrompt(agentId, state.task);
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages,
      ]);
      
      return { messages: [response], iteration: state.iteration + 1 };
    })
    .addNode('tools', new ToolNode(tools))
    .addNode('format_output', async (state) => {
      // Extrai resultado estruturado da ultima mensagem
      const lastMessage = state.messages[state.messages.length - 1];
      const parsed = parseStructuredOutput(lastMessage, state.task.output_schema);
      return { result: parsed };
    })
    
    .addEdge(START, 'execute')
    .addConditionalEdges('execute', (state) => {
      if (state.iteration >= MAX_WORKER_ITERATIONS) return 'format_output';
      const last = state.messages[state.messages.length - 1];
      if (hasToolCalls(last)) return 'tools';
      return 'format_output';
    })
    .addEdge('tools', 'execute')
    .addEdge('format_output', END);
}

// Instanciar workers
const pediatriaWorker = createWorkerGraph('pediatria_agent', PEDIATRIA_TOOLS);
const financeiroWorker = createWorkerGraph('financeiro_agent', FINANCEIRO_TOOLS);
const comercialWorker = createWorkerGraph('comercial_agent', COMERCIAL_TOOLS);
const recepcaoWorker = createWorkerGraph('recepcao_agent', RECEPCAO_TOOLS);
const estoqueWorker = createWorkerGraph('estoque_agent', ESTOQUE_TOOLS);
const rhOpsWorker = createWorkerGraph('rh_ops_agent', RH_OPS_TOOLS);
const clinicaGeralWorker = createWorkerGraph('clinica_geral_agent', CLINICA_GERAL_TOOLS);
```

---

## 9. Vault e Memoria

### 9.1 Estrutura do Vault por Agente

```
clinica-vault/
├── global/                    # Memorias compartilhadas
│   ├── MEMORY.md              # Indice global (<200 linhas)
│   ├── regras_negocio.md
│   ├── protocolos_gerais.md
│   └── decisoes_estrategicas.md
│
├── ceo_agent/                 # CEO Agent
│   ├── MEMORY.md
│   ├── insights_cross_sector.md
│   └── alertas_historicos.md
│
├── pediatria_agent/
│   ├── MEMORY.md
│   ├── padroes_crescimento.md
│   ├── protocolos_pediatricos.md
│   └── sazonalidade.md
│
├── financeiro_agent/
│   ├── MEMORY.md
│   ├── padroes_receita.md
│   ├── benchmark_margens.md
│   └── ciclos_pagamento.md
│
├── comercial_agent/
│   ├── MEMORY.md
│   ├── objecoes_frequentes.md
│   ├── canais_aquisicao.md
│   └── sazonalidade_leads.md
│
├── recepcao_agent/
│   ├── MEMORY.md
│   ├── scripts_eficazes.md
│   ├── horarios_pico.md
│   └── padroes_resposta.md
│
├── estoque_agent/
│   ├── MEMORY.md
│   └── padroes_consumo.md
│
├── rh_ops_agent/
│   ├── MEMORY.md
│   └── produtividade_equipe.md
│
├── reports/                   # Relatorios gerados
│   ├── daily/
│   ├── weekly/
│   └── monthly/
│
└── logs/                      # Logs de decisao (append-only)
    └── YYYY/MM/YYYY-MM-DD.md
```

### 9.2 Memoria por Sessao (Session Memory Extraction)

Adaptado do Claude Code. Apos cada sessao com 10+ mensagens:

```typescript
async function extractSessionMemories(
  agentId: string,
  messages: BaseMessage[]
): Promise<void> {
  if (messages.length < 10) return;
  
  const transcript = messages
    .map(m => `${m._getType()}: ${m.content}`)
    .join('\n');
  
  const extraction = await llm.invoke([
    new SystemMessage(`
      Voce e um extrator de memorias. Identifique fatos, padroes e decisoes
      desta conversa que seriam uteis em sessoes futuras.
      
      Formato: MEMORY: <tipo> | <confianca 0-10> | <fato conciso>
      
      Tipos: regra_negocio, protocolo_clinico, padrao_comportamental,
             recurso_equipe, processo_operacional, feedback_melhoria
      
      Regras:
      - Sem PII (nomes de pacientes, telefones, CPF)
      - Apenas fatos generalizaveis, nao casos especificos
      - Converter datas relativas em absolutas
    `),
    new HumanMessage(transcript),
  ]);
  
  const memories = parseMemoryLines(extraction.content);
  for (const mem of memories.filter(m => m.confidence >= 7)) {
    await saveToVault(agentId, mem);
  }
}
```

---

## 10. APIs e Integracao

### 10.1 Novas Rotas

```
# CEO Agent
POST /api/ai/ceo/chat              # Chat streaming com CEO Agent
POST /api/ai/ceo/new-session       # Reset de sessao

# Worker Agents (invocados pelo CEO ou por cron)
POST /api/ai/worker/execute         # Executa task de worker
POST /api/ai/worker/report          # Gera relatorio setorial

# Swarm
POST /api/ai/swarm/execute          # Executa analise em enxame

# Tasks
GET  /api/ai/tasks                  # Lista tasks ativas
GET  /api/ai/tasks/:id              # Detalhe de task
POST /api/ai/tasks/:id/cancel       # Cancela task

# Reports
GET  /api/ai/reports                # Lista relatorios
GET  /api/ai/reports/:id            # Detalhe de relatorio
GET  /api/ai/reports/latest/:agent  # Ultimo relatorio do agente

# Dream
POST /api/ai/dream/trigger/:agent   # Trigger manual de sonho
GET  /api/ai/dream/status           # Status do sistema de sonho

# Scheduler
GET  /api/ai/scheduler/status       # Status das analises agendadas
POST /api/ai/scheduler/run/:type    # Trigger manual (daily/weekly/monthly)
```

### 10.2 Dashboard do CEO

Nova pagina: `/dashboard/neural-network`

Mostra:
- Status de cada agente (idle, running, dreaming)
- Ultimos relatorios por setor
- Alertas ativos
- Tasks em andamento
- Historico de custo (tokens) por agente
- Metricas de precisao (verificacoes que passaram/falharam)

---

## 11. Migracao da Clara v1 para v2

### 11.1 O que muda

| Componente | v1 | v2 |
|---|---|---|
| Clara main graph | Monolitico (5 nos) | CEO Agent (coordinator, 8 nos) |
| Researcher | Sub-grafo unico | Workers setoriais (7 grafos) |
| Tools | Todas no mesmo agente | Segregadas por role |
| Output | Texto livre | JSON estruturado + narrativa |
| Memoria | Vault unico | Vault por agente + global |
| Analises | On-demand apenas | Scheduled (diaria/semanal/mensal) + on-demand |
| Verificacao | spot_check basico | Worker de verificacao dedicado |
| Comunicacao | N/A | TaskStore + Agent Messages |

### 11.2 O que NAO muda

- **Ingestion Agent** — Continua igual (webhook -> parse -> save -> insight)
- **Copilot Agent** — Continua igual (assistente da Joana)
- **Autonomous Agent** — Continua igual (reengajamento)
- **Checkpointer** — Continua PostgreSQL
- **Vault system** — Expandido mas compativel
- **API /api/ai/clara/chat** — Redireciona para CEO Agent

### 11.3 Fases de Implementacao

```
FASE 1 — Foundation (Semana 1-2)
  ├─ Criar tabelas: clara_tasks, clara_agent_messages, clara_agent_reports
  ├─ Implementar tool_registry.ts com segregacao
  ├─ Implementar output_schemas.ts
  ├─ Criar worker_graph.ts (template)
  └─ Testes unitarios

FASE 2 — Workers (Semana 3-4)
  ├─ Implementar financeiro_agent (primeiro, mais util)
  ├─ Implementar recepcao_agent (segundo, mais dados)
  ├─ Implementar comercial_agent
  ├─ Testar cada worker isoladamente
  └─ Validar outputs estruturados

FASE 3 — Coordinator (Semana 5-6)
  ├─ Implementar CEO Agent graph
  ├─ Implementar dispatch_workers_node
  ├─ Implementar synthesize_node com agregacao programatica
  ├─ Implementar verify_node
  └─ Testar fluxo completo: pergunta -> workers -> sintese -> resposta

FASE 4 — Dream + Schedule (Semana 7-8)
  ├─ Implementar dream_system.ts
  ├─ Implementar scheduled_analyses.ts
  ├─ Implementar cron jobs (daily/weekly/monthly)
  ├─ Criar vault structure por agente
  └─ Testar ciclo completo de sonho

FASE 5 — Swarm + Polish (Semana 9-10)
  ├─ Implementar swarm_executor.ts
  ├─ Implementar workers restantes (pediatria, clinica_geral, estoque, rh)
  ├─ Dashboard /neural-network
  ├─ Modo Rapido (model selection automatica)
  └─ Performance tuning + custo optimization

FASE 6 — Production (Semana 11-12)
  ├─ Migracao gradual: Clara v1 → CEO Agent
  ├─ Monitoramento de custos (token usage)
  ├─ Ajuste de thresholds (dream gates, timeouts)
  ├─ Treinamento dos brain files por agente
  └─ Go-live
```

---

## 12. Metricas de Sucesso

| Metrica | Meta | Como medir |
|---|---|---|
| Precisao de respostas numericas | >95% | Verificacao automatica por amostragem |
| Tempo de resposta (pergunta simples) | <10s | Latencia do simple_answer_node |
| Tempo de resposta (cross-sector) | <60s | Latencia total do fluxo coordinator |
| Custo por analise diaria | <$0.50 | Token usage por agente |
| Custo por pergunta CEO | <$0.30 | Token usage por sessao |
| Relatorios diarios gerados | 100% | Cron success rate |
| Memorias uteis retidas | >80% quality score | Pipeline de qualidade |
| Alertas falso-positivo | <10% | Review manual semanal |

---

## 13. Riscos e Mitigacoes

| Risco | Impacto | Mitigacao |
|---|---|---|
| Custo de tokens explode | Alto | Budget caps por agente, Modo Rapido, Flash Lite para batch |
| Worker fica preso em loop | Medio | 4 camadas de safety (iterations, tokens, timeout, cost) |
| Dados inconsistentes entre workers | Alto | Verificacao por amostragem, temporal anchor compartilhado |
| Dream sobrescreve memoria valida | Medio | Contradiction guard, lock file, versionamento |
| Latencia alta para CEO | Medio | Parallel dispatch, Modo Rapido, cache de relatorios |
| Agente alucina dados | Critico | Output estruturado + SQL validation + spot-check |

---

## 14. Ferramentas Adaptadas do Claude Code

### 14.1 Tools que clonamos

| Tool Claude Code | Nossa Adaptacao | Justificativa |
|---|---|---|
| `Agent` (spawn workers) | `dispatch_worker` | Core da orquestracao |
| `TaskCreate/Update/Get/List` | `manage_tasks` | Rastreamento de tasks |
| `TaskStop` | `cancel_task` | Cancelar workers runaway |
| `TaskOutput` | `wait_task_result` | Blocking wait por resultado |
| `SendMessage` | `send_directive` | Comunicacao coordinator→worker |
| `CronCreate/List/Delete` | `schedule_analysis` | Analises automaticas |
| `Read/Grep/Glob` | `vault_read/search/semantic` | Ja existem no vault |
| `EnterPlanMode` | `plan_tasks_node` | Fase de planejamento |
| `ToolSearch` | `discover_tools` | Agente descobre tools disponiveis |
| `WebFetch` | `fetch_external_data` | APIs externas (FHIR, seguros) |
| `StructuredOutput` | `output_schemas` | Outputs tipados por Zod |

### 14.2 Tools que NAO clonamos

| Tool Claude Code | Motivo |
|---|---|
| `Bash/PowerShell` | Nao executamos shell; nosso runtime e serverless |
| `FileEdit/FileWrite` | Nao editamos arquivos de codigo em runtime |
| `EnterWorktree` | Conceito de git, irrelevante |
| `TeamCreate/Delete` | Overengineering; agentes sao fixos |
| `ComputerUse` | Sem GUI automation necessaria |
| `LSP` | Sem IDE integration |
| `REPL` | Sem interpreters persistentes |
| `Notebook` | Sem Jupyter |

---

## Apendice A: Mapeamento Preciso de Tabelas por Agente

Baseado no levantamento completo do banco de dados (~95 tabelas, 2 schemas).

### A.1 CEO Agent (Coordinator) — Acesso Indireto via Workers

O CEO Agent NAO acessa tabelas diretamente. Ele le:
- `clara_tasks` — Tasks delegadas e seus resultados
- `clara_agent_messages` — Mensagens inter-agente
- `clara_agent_reports` — Relatorios gerados pelos workers
- `agent_config` — Brain files / regras de negocio
- `clara_memories` — Memorias consolidadas (vault global)
- `knowledge_base` — Base de conhecimento

### A.2 Pediatria Agent

**Schema: `public`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `patients` | id, name, phone, created_at | Pacientes pediatricos |
| `appointments` | id, patient_id, doctor_id, start_time, end_time, status, appointment_type | Consultas pediatricas |
| `medical_records` | id, patient_id, doctor_id, status, finished_at | Prontuarios |
| `anthropometry_entries` | patient_id, measurement_date, weight_kg, height_cm, head_circumference_cm, bmi, is_premature | Curvas de crescimento |
| `growth_standards` | source(WHO/CDC), type(wfa/lhfa/bmifa), gender, age_months, l, m, s, p3-p97 | Padroes de referencia |
| `patient_cids` | patient_id, cid_code, cid_description, status(active/resolved/chronic) | Diagnosticos CID-10 |
| `patient_allergies` | patient_id, answers, notes, alert_system | Alergias |

**Schema: `atendimento`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `anamneses` | patient_id, doctor_id, appointment_id, content, signed | Historias clinicas |
| `clinical_evolutions` | patient_id, doctor_id, content, evolution_date, signed | Evolucoes |
| `medical_certificates` | patient_id, doctor_id, content, certificate_date | Atestados |
| `medical_reports` | patient_id, doctor_id, content, report_date | Laudos |
| `exam_results` | patient_id, exam_name, result_date, content | Resultados exames |
| `therapeutic_plans` | patient_id, status(active/completed/cancelled), procedures(JSONB) | Planos terapeuticos |
| `procedures` | id, name, procedure_type(consultation/exam/injectable/other), duration_minutes, total_value | Procedimentos |
| `clinical_protocols` | id, name, total_value, status | Protocolos clinicos |

**Queries tipicas:**
```sql
-- Volume de consultas pediatricas por dia
SELECT date(start_time), count(*), 
  count(*) FILTER (WHERE status = 'finished') as realizadas,
  count(*) FILTER (WHERE status = 'no_show') as faltas
FROM appointments 
WHERE start_time BETWEEN $1 AND $2
  AND appointment_type IN ('consultation', 'retorno')
  AND doctor_id IN (SELECT id FROM doctors WHERE name ILIKE '%pediatr%')
GROUP BY 1 ORDER BY 1;

-- Desvios de crescimento
SELECT ae.patient_id, p.name, ae.weight_kg, ae.height_cm, ae.bmi,
  ae.measurement_date
FROM anthropometry_entries ae
JOIN patients p ON p.id = ae.patient_id
WHERE ae.measurement_date BETWEEN $1 AND $2
  AND (ae.bmi < 14 OR ae.bmi > 25);
```

### A.3 Clinica Geral Agent

**Schema: `public`**

| Tabela | Uso |
|---|---|
| `appointments` | Consultas de clinica geral (filtro por doctor_id nao-pediatra) |
| `medical_records` | Prontuarios de clinica geral |
| `medical_checkouts` | Checkouts de consultas (consultation_value, status) |
| `doctors` | Medicos e profissionais |

**Schema: `atendimento`**

| Tabela | Uso |
|---|---|
| `professionals` | professional_type, specialty, has_schedule |
| `professional_procedures` | Procedimentos por profissional (value, split_type, split_value) |
| `procedures` | Catalogo de procedimentos |
| `clinical_evolutions` | Evolucoes clinicas |
| `anamneses` | Anamneses |
| `budgets` + `budget_items` | Orcamentos (status, total, discount) |

**Queries tipicas:**
```sql
-- Produtividade por profissional
SELECT d.name, count(a.id) as consultas,
  count(a.id) FILTER (WHERE a.status = 'finished') as finalizadas,
  avg(EXTRACT(EPOCH FROM (a.end_time - a.start_time))/60) as tempo_medio_min
FROM appointments a
JOIN doctors d ON d.id = a.doctor_id
WHERE a.start_time BETWEEN $1 AND $2
GROUP BY d.name ORDER BY consultas DESC;
```

### A.4 Recepcao Agent

**Schema: `public`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `chats` | id, phone, patient_id, status, last_interaction_at, last_message, profile_pic | Conversas WhatsApp |
| `chat_messages` | id, chat_id, content, message_type, status, sender_type, created_at | Mensagens |
| `appointments` | id, patient_id, start_time, status, scheduled_by | Agendamentos |
| `tasks` | id, user_id, title, status, due_date, chat_id, type | Tarefas da recepcao |
| `macros` | id, title, content, category | Templates de mensagem |
| `saved_call_messages` | id, content | Mensagens de chamada |

**Queries tipicas:**
```sql
-- Tempo medio de resposta da recepcao
WITH first_patient_msg AS (
  SELECT chat_id, min(created_at) as patient_at
  FROM chat_messages 
  WHERE sender_type = 'patient' AND created_at BETWEEN $1 AND $2
  GROUP BY chat_id
),
first_reply AS (
  SELECT cm.chat_id, min(cm.created_at) as reply_at
  FROM chat_messages cm
  JOIN first_patient_msg fp ON fp.chat_id = cm.chat_id
  WHERE cm.sender_type = 'user' AND cm.created_at > fp.patient_at
  GROUP BY cm.chat_id
)
SELECT avg(EXTRACT(EPOCH FROM (fr.reply_at - fp.patient_at))/60) as avg_response_min
FROM first_patient_msg fp
JOIN first_reply fr ON fr.chat_id = fp.chat_id;
```

### A.5 Financeiro Agent

**Schema: `public`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `financial_transactions` | id, amount, occurred_at, origin(atendimento/loja), group_code, appointment_id, sale_id, medical_checkout_id | Transacoes |
| `financial_transaction_payments` | transaction_id, payment_method(pix/cash/credit_card/debit_card), amount | Pagamentos |
| `financial_daily_closures` | closure_date, totals_by_method(JSONB), totals_by_origin(JSONB), total_amount | Fechamentos |
| `sales` | id, total, status, payment_method, origin(atendimento/loja), created_at | Vendas |
| `sale_items` | sale_id, product_id, quantity, unit_price | Itens vendidos |
| `medical_checkouts` | id, patient_id, consultation_value, status, completed_at | Checkouts medicos |
| `checkout_items` | checkout_id, product_id, quantity, type | Itens do checkout |

**Schema: `atendimento`**

| Tabela | Uso |
|---|---|
| `budgets` | Orcamentos (subtotal, discount, total, status) |
| `budget_items` | Itens do orcamento (procedure_name, sessions, unit_price) |
| `invoices` | NFe (amount, taxes, status, nfe_number) |

**Queries tipicas:**
```sql
-- DRE simplificado
SELECT 
  sum(ft.amount) as receita_total,
  sum(ft.amount) FILTER (WHERE ft.origin = 'atendimento') as receita_consultas,
  sum(ft.amount) FILTER (WHERE ft.origin = 'loja') as receita_loja,
  json_object_agg(ftp.payment_method, ftp.total) as por_metodo
FROM financial_transactions ft
LEFT JOIN LATERAL (
  SELECT payment_method, sum(amount) as total
  FROM financial_transaction_payments
  WHERE transaction_id = ft.id
  GROUP BY payment_method
) ftp ON true
WHERE ft.occurred_at BETWEEN $1 AND $2;

-- Ticket medio por profissional
SELECT d.name, 
  count(DISTINCT mc.id) as checkouts,
  avg(mc.consultation_value) as ticket_medio
FROM medical_checkouts mc
JOIN appointments a ON a.id = mc.appointment_id
JOIN doctors d ON d.id = a.doctor_id
WHERE mc.completed_at BETWEEN $1 AND $2
GROUP BY d.name;
```

### A.6 Comercial Agent

**Schema: `public`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `chats` | id, phone, patient_id, status, last_interaction_at | Funil de conversas |
| `chat_messages` | chat_id, content, sender_type, created_at | Analise de objecoes |
| `appointments` | patient_id, status, start_time, appointment_type | Conversao agendamento→consulta |
| `automation_rules` | id, name, type(milestone/appointment_reminder/return_reminder), active, message_sequence(JSONB) | Regras de automacao |
| `automation_logs` | automation_rule_id, patient_id, status(pending/sent/failed), sent_at | Logs de execucao |
| `automation_sent_history` | automation_rule_id, patient_id, milestone_age, sent_at | Historico de envios |
| `scheduled_messages` | chat_id, content, scheduled_for, status, automation_rule_id | Fila de mensagens |
| `tasks` | title, status, due_date, chat_id | Tasks comerciais |

**Schema: `atendimento`**

| Tabela | Uso |
|---|---|
| `patients` (atendimento) | Dados demograficos para segmentacao |

**Queries tipicas:**
```sql
-- Funil de conversao
WITH chat_stages AS (
  SELECT c.id,
    CASE 
      WHEN a.id IS NOT NULL AND a.status = 'finished' THEN 'converted'
      WHEN a.id IS NOT NULL THEN 'scheduled'
      WHEN c.last_interaction_at > NOW() - INTERVAL '48h' THEN 'active'
      ELSE 'lost'
    END as stage
  FROM chats c
  LEFT JOIN appointments a ON a.chat_id = c.id AND a.start_time BETWEEN $1 AND $2
  WHERE c.created_at BETWEEN $1 AND $2
)
SELECT stage, count(*) FROM chat_stages GROUP BY stage;
```

### A.7 Estoque Agent

**Schema: `public`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `products` | id, name, category, price_sale, price_cost, stock, active | Catalogo |
| `product_batches` | product_id, batch_number, quantity, expiration_date | Lotes (FEFO) |
| `stock_movements` | product_id, movement_type(purchase_in/sale_out/adjustment/loss/return), quantity_change, reason, created_at | Movimentacoes |
| `sales` | id, total, status, origin, created_at | Vendas |
| `sale_items` | sale_id, product_id, quantity, unit_price | Itens vendidos |

**Queries tipicas:**
```sql
-- ABC Analysis (Curva ABC)
SELECT p.name, p.category,
  sum(si.quantity * si.unit_price) as faturamento,
  sum(si.quantity) as unidades_vendidas,
  p.stock as estoque_atual,
  CASE WHEN sum(si.quantity) > 0 
    THEN p.stock::float / (sum(si.quantity)::float / 30) 
    ELSE null 
  END as dias_estoque
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.id
LEFT JOIN sales s ON s.id = si.sale_id 
  AND s.created_at BETWEEN $1 AND $2 AND s.status = 'completed'
WHERE p.active = true
GROUP BY p.id ORDER BY faturamento DESC;
```

### A.8 RH/Ops Agent

**Schema: `atendimento`**

| Tabela | Colunas-Chave | Uso |
|---|---|---|
| `professionals` | id, name, professional_type, specialty, status, has_schedule | Profissionais |
| `professional_procedures` | professional_id, name, duration_minutes, value, split_type, split_value | Procedimentos por profissional |
| `collaborators` | id, name, role(administrator/receptionist/seller), status | Colaboradores |

**Schema: `public`**

| Tabela | Uso |
|---|---|
| `appointments` | Ocupacao de agenda por profissional |
| `doctors` + `doctor_schedules` | Disponibilidade configurada |
| `schedule_overrides` | Bloqueios e excecoes |
| `profiles` | Usuarios do sistema (role, status, last_login) |

**Queries tipicas:**
```sql
-- Taxa de ocupacao por profissional
WITH disponivel AS (
  SELECT doctor_id, 
    count(*) * 30 as minutos_disponiveis  -- slots de 30min
  FROM doctor_schedules
  WHERE day_of_week = EXTRACT(DOW FROM $1::date)
  GROUP BY doctor_id
),
ocupado AS (
  SELECT doctor_id, 
    count(*) as consultas,
    sum(EXTRACT(EPOCH FROM (end_time - start_time))/60) as minutos_ocupados
  FROM appointments
  WHERE date(start_time) = $1::date AND status NOT IN ('cancelled', 'no_show')
  GROUP BY doctor_id
)
SELECT d.name, 
  COALESCE(o.consultas, 0) as consultas,
  COALESCE(o.minutos_ocupados, 0) as min_ocupados,
  COALESCE(di.minutos_disponiveis, 0) as min_disponiveis,
  CASE WHEN di.minutos_disponiveis > 0 
    THEN round(o.minutos_ocupados / di.minutos_disponiveis * 100) 
    ELSE 0 
  END as ocupacao_pct
FROM doctors d
LEFT JOIN ocupado o ON o.doctor_id = d.id
LEFT JOIN disponivel di ON di.doctor_id = d.id;
```

---

## Apendice B: Tabelas Existentes do Sistema de IA (Reutilizaveis)

Estas tabelas ja existem e serao reutilizadas/expandidas:

| Tabela | Status | Acao na v2 |
|---|---|---|
| `clara_memories` | Existe | Adicionar coluna `agent_id TEXT` para segmentar por agente |
| `agent_config` | Existe | Adicionar configs por agente setorial (brain files) |
| `clara_reports` | Existe | Renomear para `clara_agent_reports` + adicionar `agent_id`, `structured_data` |
| `clara_scheduled_tasks` | Existe | Expandir para suportar tasks do coordinator (ou criar `clara_tasks` separado) |
| `knowledge_base` | Existe | Manter como KB global compartilhada |
| `agent_reports` | Existe | Avaliar merge com `clara_agent_reports` |
| `langgraph_dead_letter` | Existe | Reutilizar para dead letters de workers |
| `worker_run_logs` | Existe | Reutilizar para logs de execucao dos workers |
| `daily_kpi_snapshots` | Existe | Reutilizar como cache de KPIs pre-computados |

### Novas tabelas necessarias:

| Tabela | Descricao |
|---|---|
| `clara_tasks` | TaskStore do coordinator (ver schema na secao 3.4) |
| `clara_agent_messages` | Comunicacao inter-agente (ver schema na secao 3.5) |
| `clara_dream_state` | Estado de consolidacao por agente (last_consolidated_at, lock) |

### Migracoes de tabelas existentes:

```sql
-- Adicionar agent_id em clara_memories
ALTER TABLE clara_memories ADD COLUMN agent_id TEXT DEFAULT 'ceo_agent';
CREATE INDEX idx_clara_memories_agent ON clara_memories(agent_id);

-- Adicionar structured_data em clara_reports (se reutilizar)
ALTER TABLE clara_reports ADD COLUMN agent_id TEXT DEFAULT 'ceo_agent';
ALTER TABLE clara_reports ADD COLUMN structured_data JSONB;
ALTER TABLE clara_reports ADD COLUMN report_type TEXT DEFAULT 'on_demand';
ALTER TABLE clara_reports ADD COLUMN period_start DATE;
ALTER TABLE clara_reports ADD COLUMN period_end DATE;
CREATE INDEX idx_clara_reports_agent_type ON clara_reports(agent_id, report_type);
```

---

## Apendice C: RPCs Existentes Reutilizaveis pelos Workers

| RPC | Worker que usa | Descricao |
|---|---|---|
| `match_memories(query_embedding, match_threshold, match_count)` | Todos | Busca semantica no vault (pgvector) |
| `search_cid10(search_term)` | Pediatria, Clinica Geral | Busca fuzzy de CID-10 |
| `claim_scheduled_messages(batch_size, worker_id, now, max_retries)` | Recepcao, Comercial | Claim de mensagens para dispatch |
| `process_secretary_checkout(payload)` | Financeiro (read-only analytics) | Entender fluxo de checkout |
| `finish_consultation(payload)` | Clinica Geral (read-only analytics) | Entender fluxo de consulta |

---

## Apendice D: Campos JSONB Criticos

Varias tabelas usam JSONB para dados flexiveis. Os workers precisam saber parsear:

| Tabela.Coluna | Estrutura | Worker |
|---|---|---|
| `financial_daily_closures.totals_by_method` | `{"pix": 1500.00, "credit_card": 3200.00, ...}` | Financeiro |
| `financial_daily_closures.totals_by_origin` | `{"atendimento": 4000.00, "loja": 700.00}` | Financeiro |
| `automation_rules.message_sequence` | `[{"type": "text", "content": "...", "delay_hours": 24}]` | Comercial |
| `automation_rules.variables_template` | `{"patient_name": "", "doctor_name": ""}` | Comercial |
| `medical_records.vitals` | `{"weight": 70, "height": 175, "bp": "120/80"}` | Pediatria, Clin. Geral |
| `therapeutic_plans.procedures` | `[{"name": "Fisio", "sessions": 10, "value": 150}]` | Pediatria, Clin. Geral |
| `stock_movements.metadata` | `{"batch_number": "L001", "expiration": "2026-12"}` | Estoque |
| `chats.last_message_data` | `{"type": "image", "url": "...", "caption": "..."}` | Recepcao |

---

*Fim do PRD v2.1*
