# PRD — Painel Clínica: Arquitetura Multi-Módulo

**Versão:** 1.0
**Data:** 2026-03-04
**Status:** Definido — aguardando implementação

---

## 1. Visão Geral

Transformar o sistema atual (módulo pediatria) na base de uma plataforma multi-módulo para gestão completa de clínica médica. Cada módulo é um setor independente com suas próprias regras de negócio, dados, IA e integrações.

### Módulos Planejados

| Módulo | Descrição | Status |
|--------|-----------|--------|
| **Pediatria** | Atendimento pediátrico, WhatsApp, prontuários, financeiro do setor, loja, automações | Em produção |
| **Atendimento Geral** | Similar à pediatria mas maior — outro WhatsApp, multi-médico, outras lógicas | Planejado |
| **Financeiro** | Gestão financeira geral da clínica — consolida todos os setores | Planejado |
| **Comercial** | Relacionamento com médicos parceiros, pipeline comercial, comissões | Planejado |
| **Sistema CEO** | Dashboard executivo — métricas unificadas, acesso a todos os módulos | Planejado |

---

## 2. Decisões Arquiteturais

### 2.1 Banco de Dados — Schemas PostgreSQL

**Princípio:** schemas são namespaces lógicos no mesmo banco. Suportam FK, JOIN, views, triggers e transações cross-schema nativamente.

**Regra de ouro:** NUNCA mover tabelas existentes do `public`. O que está em produção fica intocado.

```
public (Pediatria + Core mínimo)
│
│  CORE (compartilhado):
│  ├── profiles              → auth + RBAC
│  ├── user_modules          → controle de acesso por módulo (NOVO)
│  ├── audit_log             → auditoria global
│  ├── agent_config          → config de agentes IA
│  ├── knowledge_base        → base de conhecimento IA
│  ├── clara_reports         → relatórios gerados por IA
│  └── langgraph_*           → checkpointing de IA
│
│  PEDIATRIA (tabelas existentes, sem alteração):
│  ├── patients, patient_phones, patient_relations
│  ├── doctors, schedule_rules, shifts
│  ├── chats, chat_messages, chat_notes, message_reactions
│  ├── appointments, medical_records, anthropometry_entries
│  ├── medical_checkouts, checkout_items
│  ├── financial_transactions, financial_daily_closures
│  ├── financial_transaction_payments
│  ├── sales, sale_items, products, product_batches, stock_movements
│  ├── automation_rules, automation_logs, automation_sent_history
│  ├── scheduled_messages, macros, funnels
│  ├── growth_standards, cid10_sub_categoria
│  └── (todas as demais tabelas atuais)

atendimento (NOVO schema)
│  ├── patients              → pacientes próprios (NÃO compartilha com pediatria)
│  ├── chats, chat_messages  → outro WhatsApp, outra instância
│  ├── appointments          → com suporte multi-médico
│  ├── doctor_assignments    → vinculação dinâmica médico↔consulta
│  ├── medical_records       → prontuários com estratégia própria
│  ├── medical_checkouts
│  ├── financial_transactions, financial_transaction_payments
│  ├── sales, sale_items
│  ├── automation_rules, scheduled_messages
│  └── (estrutura similar à pediatria, lógica diferente)

financeiro (NOVO schema — financeiro GERAL da clínica)
│  ├── consolidated_transactions  → agrega pediatria + atendimento + comercial
│  ├── accounts_payable           → contas a pagar
│  ├── accounts_receivable        → contas a receber
│  ├── cost_centers               → centros de custo
│  ├── bank_accounts              → contas bancárias
│  ├── invoices                   → notas fiscais
│  ├── budget_plans               → orçamentos
│  └── payroll                    → folha de pagamento

comercial (NOVO schema)
│  ├── partner_doctors        → médicos parceiros
│  ├── partner_contracts      → contratos
│  ├── referrals              → encaminhamentos
│  ├── commercial_pipelines   → pipeline de relacionamento
│  ├── relationship_logs      → histórico de interações
│  └── commission_rules       → regras de comissão

ceo (NOVO schema — somente views/materialized views)
│  ├── vw_financial_overview      → consolida financeiro de todos os módulos
│  ├── vw_attendance_kpis         → métricas de atendimento (pediatria + geral)
│  ├── vw_commercial_metrics      → métricas comerciais
│  ├── vw_module_health           → saúde operacional por módulo
│  └── vw_revenue_by_origin       → receita por origem/setor
```

### 2.2 Pacientes NÃO são compartilhados

Cada módulo tem sua própria tabela `patients` e sua própria estratégia de gestão de prontuários. Pacientes da pediatria ficam em `public.patients`; pacientes do atendimento geral ficam em `atendimento.patients`. Não há FK entre eles.

**Motivo:** prontuários médicos têm requisitos diferentes por especialidade. A estratégia de gestão será definida individualmente por módulo.

**Futuro:** se necessário unificar, será via tabela de vínculo (`patient_links`) ou matching por CPF/telefone — nunca por merge de tabelas.

### 2.3 Comunicação Cross-Schema

Os schemas se comunicam via SQL nativo do PostgreSQL:

- **FK cross-schema:** `atendimento.X` pode referenciar `public.Y` quando necessário
- **Views cross-schema:** CEO agrega dados de todos os schemas
- **Triggers cross-schema:** checkout em qualquer módulo pode alimentar `financeiro.consolidated_transactions`
- **JOINs cross-schema:** queries normais com `schema.tabela`
- **Transações atômicas:** operações em múltiplos schemas na mesma transaction

### 2.4 Acesso no Supabase JS

```typescript
// Pediatria (public — funciona como hoje, sem mudança)
supabase.from('chats').select('*')

// Outros módulos
supabase.schema('atendimento').from('chats').select('*')
supabase.schema('financeiro').from('consolidated_transactions').select('*')
```

---

## 3. Controle de Acesso (RBAC por Módulo)

### 3.1 Nova Tabela `user_modules`

```sql
CREATE TABLE public.user_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,  -- 'pediatria','atendimento','financeiro','comercial','ceo'
  role TEXT NOT NULL,    -- 'admin','manager','operator','viewer'
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, module)
);
```

### 3.2 Roles por Módulo

| Role | Permissões |
|------|-----------|
| `admin` | CRUD total no módulo + configurações |
| `manager` | CRUD total exceto configurações sensíveis |
| `operator` | Operações do dia-a-dia (criar, editar) |
| `viewer` | Somente leitura |

### 3.3 Função RLS Genérica

```sql
CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_modules um
    JOIN public.profiles p ON p.id = um.profile_id
    WHERE p.id = auth.uid()
      AND p.active = true
      AND p.status = 'approved'
      AND um.module = p_module
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Cada schema aplica RLS usando essa função:
```sql
CREATE POLICY "module_access" ON atendimento.chats
  FOR ALL USING (public.user_has_module_access('atendimento'));
```

---

## 4. Segurança — 4 Camadas

```
Camada 1 → Middleware Next.js
  - Verifica sessão autenticada
  - Extrai módulo da URL (/pediatria/*, /financeiro/*)
  - Consulta user_modules → bloqueia se sem acesso
  - Redirect para /selecionar-modulo

Camada 2 → Layout do Módulo (Server Component)
  - Revalida acesso no Supabase server-side
  - Injeta ModuleContext com role do usuário

Camada 3 → API Routes
  - Cada endpoint verifica módulo + role
  - Helper: requireModuleAccess('financeiro', 'operator')

Camada 4 → RLS no Banco
  - Última linha de defesa
  - Mesmo com bypass de middleware/API, banco bloqueia
```

---

## 5. Estrutura de Rotas Next.js

```
src/app/
├── (auth)/
│   ├── login/
│   ├── signup/
│   └── aguardando-aprovacao/
│
├── (platform)/
│   ├── layout.tsx                  → Shell geral + auth guard
│   ├── selecionar-modulo/          → Hub pós-login (cards dos módulos)
│   │
│   ├── pediatria/                  → Módulo atual reestruturado
│   │   ├── layout.tsx              → PediatriaProvider + sidebar
│   │   ├── dashboard/
│   │   ├── chats/
│   │   ├── agenda/
│   │   ├── clients/
│   │   ├── financeiro/             → Financeiro DO SETOR
│   │   ├── loja/
│   │   ├── automatizacoes/
│   │   └── configuracoes/
│   │
│   ├── atendimento/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── chats/                  → Outro WhatsApp
│   │   ├── agenda/
│   │   ├── medicos/                → Gestão multi-médico
│   │   ├── financeiro/             → Financeiro DO SETOR
│   │   └── configuracoes/
│   │
│   ├── financeiro/                 → Financeiro GERAL da clínica
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── transacoes/
│   │   ├── contas-pagar/
│   │   ├── contas-receber/
│   │   ├── fechamentos/
│   │   └── relatorios/
│   │
│   ├── comercial/
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── parceiros/
│   │   ├── pipeline/
│   │   └── relatorios/
│   │
│   └── ceo/
│       ├── layout.tsx
│       ├── dashboard/              → Visão executiva unificada
│       ├── modulos/                → Atalhos para qualquer módulo
│       └── relatorios/
│
└── api/
    ├── auth/
    ├── shared/                     → APIs core (audit, config)
    ├── pediatria/                  → APIs existentes reorganizadas
    │   ├── whatsapp/
    │   ├── ai/
    │   ├── finance/
    │   └── ...
    ├── atendimento/
    ├── financeiro/
    ├── comercial/
    └── ceo/
```

---

## 6. IA por Módulo

### Clara (Pediatria) — já em produção
- Mantém arquitetura atual (LangGraph supervisor + researchers)
- Schema: queries no `public` (pediatria)

### Agente Atendimento Geral — a desenvolver
- Arquitetura similar à Clara, adaptada para multi-médico
- Schema: queries no `atendimento`
- WhatsApp: outra instância Evolution API

### Agente Financeiro — a desenvolver
- Foco em análise financeira consolidada
- Schema: queries cross-schema (financeiro + public + atendimento)

### Agente Comercial — a desenvolver
- CRM inteligente para gestão de parceiros
- Schema: queries no `comercial`

### Agente CEO — a desenvolver
- Acesso total, análise executiva
- Schema: queries no `ceo` (views agregadas)

---

## 7. Fluxo de Dados entre Módulos

```
Pediatria (public)                    Atendimento (atendimento)
  └── checkout médico                   └── checkout médico
        │                                     │
        ▼                                     ▼
  public.financial_transactions    atendimento.financial_transactions
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
            financeiro.consolidated_transactions
              (view ou materialized view)
                       │
                       ▼
              ceo.vw_financial_overview
```

Triggers ou views materializam a consolidação. Cada módulo opera independente; o financeiro geral e o CEO consomem dados agregados.

---

## 8. Estratégia de Desenvolvimento

### Fase 1 — Fundação (sem quebrar produção)
1. Criar tabela `user_modules` no `public`
2. Atualizar middleware com lógica de módulos
3. Reorganizar rotas: mover páginas atuais para `/pediatria/*`
4. Criar página `/selecionar-modulo`
5. Migrar usuários existentes: INSERT em `user_modules` com module='pediatria'

### Fase 2 — Atendimento Geral
1. Criar schema `atendimento` com migrations dedicadas
2. Configurar segunda instância WhatsApp (Evolution API)
3. Desenvolver lógica multi-médico
4. Criar agente IA do atendimento
5. Definir estratégia de prontuários para clínica geral

### Fase 3 — Financeiro Geral
1. Criar schema `financeiro`
2. Views de consolidação cross-schema
3. Contas a pagar/receber, fluxo de caixa
4. Agente IA financeiro

### Fase 4 — Comercial
1. Criar schema `comercial`
2. Pipeline de parceiros, contratos, comissões
3. Agente IA comercial

### Fase 5 — Sistema CEO
1. Criar schema `ceo` com views agregadas
2. Dashboard executivo unificado
3. Agente IA CEO com acesso cross-module

---

## 9. Estratégia de Revenda (Futuro)

Cada clínica cliente recebe:
- Schemas dos módulos contratados
- Migrations organizadas por módulo (deploy seletivo)
- Se necessário, views de alias no schema do módulo

```
Clínica A: public (core) + pediatria
Clínica B: public (core) + atendimento + financeiro
Clínica C: public (core) + todos os módulos
```

Para o módulo pediatria em revenda: criar views em schema `pediatria` apontando para `public.*` — camada cosmética sem mover dados.

---

## 10. Migrations — Organização

```
database/
├── core/                    → Migrations compartilhadas
│   ├── 001_user_modules.sql
│   └── ...
├── pediatria/               → Migrations existentes (já aplicadas)
│   └── (referência — não re-executar)
├── atendimento/
│   ├── 001_create_schema.sql
│   ├── 002_patients.sql
│   ├── 003_chats.sql
│   └── ...
├── financeiro/
│   ├── 001_create_schema.sql
│   └── ...
├── comercial/
│   ├── 001_create_schema.sql
│   └── ...
└── ceo/
    ├── 001_create_schema.sql
    └── 002_views.sql
```

---

## 11. Regras Técnicas

- **NUNCA** mover tabelas do `public` para outro schema — sistema em produção
- **NUNCA** compartilhar pacientes entre módulos sem estratégia explícita de vínculo
- **SEMPRE** usar `public.user_has_module_access()` nas RLS policies de novos schemas
- **SEMPRE** prefixar queries de outros schemas com `.schema('nome')` no Supabase JS
- Queries diretas via `pg` Pool (como `execute_sql` da Clara) usam `schema.tabela` no SQL
- Cada módulo tem seu próprio layout, sidebar, e contexto React
- APIs seguem padrão `/api/[modulo]/[recurso]`
