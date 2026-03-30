-- ═══════════════════════════════════════════════════════════════════════════
-- Migração: Agente IA da Clínica Geral (schema atendimento)
-- Cria tabelas de suporte e configura o agente no agent_config.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Agent config entries (tabela compartilhada no schema public)
INSERT INTO public.agent_config (agent_id, config_key, content, updated_at) VALUES
  ('atendimento_agent', 'company', 'CLÍNICA:
- Clínica médica geral com atendimento humanizado e sistema integrado ao WhatsApp
- Áreas: CRM (Funil), Agendamentos (Calendário), Prontuário Eletrônico, Financeiro, Fila de Atendimento
- Especialidades: Clínica Geral, múltiplas especialidades médicas

EQUIPE:
- Brendo: Criador e desenvolvedor do sistema (CEO)
- Profissionais: cadastrados na tabela professionals (múltiplos médicos e especialidades)
- Colaboradores: cadastrados na tabela collaborators (recepção, administração)

VALORES:
- Paciente sempre em primeiro lugar
- Organização absoluta com dados financeiros, médicos e agenda
- Nenhum paciente fica sem atendimento
- Gestão eficiente de fila e fluxo de atendimento', now()),

  ('atendimento_agent', 'rules', 'REGRAS OPERACIONAIS:
1. Segurança de dados: nunca expor dados médicos sensíveis indevidamente. Nunca alterar/deletar dados sem solicitação explícita.
2. Sem achismo: se precisa de dado concreto, use as ferramentas. Nunca invente.
3. Sem código no chat: use Function Calling em background, nunca mostre SQL ou código.
4. 100% digital: não prometa tarefas físicas (presença na clínica é da equipe).
5. Identificação: use nome/telefone ao mencionar chats, nunca IDs nus. Em relatórios: [[chat:ID|Nome (Telefone)]].
6. Memória: consulte memória de longo prazo antes de dar respostas definitivas sobre processos.
7. Schema: todas as queries devem usar o schema atendimento (SET search_path TO atendimento).
8. Profissionais: ao buscar médicos, consulte a tabela professionals. Não hardcode nomes.', now()),

  ('atendimento_agent', 'voice_rules', '', now())
ON CONFLICT (agent_id, config_key) DO NOTHING;

-- 2. Memórias do agente (no schema atendimento)
CREATE TABLE IF NOT EXISTS atendimento.agent_memories (
  id bigserial PRIMARY KEY,
  memory_type text NOT NULL,
  content text NOT NULL,
  quality_score numeric(5,2) DEFAULT 0,
  source_role text DEFAULT 'system',
  embedding vector(768),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON atendimento.agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_updated ON atendimento.agent_memories(updated_at DESC);

-- 3. Knowledge base
CREATE TABLE IF NOT EXISTS atendimento.knowledge_base (
  id bigserial PRIMARY KEY,
  pergunta text,
  resposta_ideal text,
  categoria text,
  tags text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_categoria ON atendimento.knowledge_base(categoria);

-- 4. Relatórios do agente
CREATE TABLE IF NOT EXISTS atendimento.agent_reports (
  id bigserial PRIMARY KEY,
  titulo text NOT NULL,
  conteudo_markdown text,
  tipo text DEFAULT 'geral',
  created_at timestamptz DEFAULT now()
);

-- 5. Tarefas agendadas do agente
CREATE TABLE IF NOT EXISTS atendimento.agent_scheduled_tasks (
  id bigserial PRIMARY KEY,
  agent_id text DEFAULT 'atendimento_agent',
  task_type text NOT NULL,
  title text NOT NULL,
  description text,
  instruction text,
  run_at timestamptz NOT NULL,
  status text DEFAULT 'pending',
  result text,
  error text,
  repeat_interval_minutes int,
  max_repeats int DEFAULT 1,
  current_repeat int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_scheduled_tasks_status ON atendimento.agent_scheduled_tasks(status, run_at);

-- 6. Chat insights (classificação por chat)
CREATE TABLE IF NOT EXISTS atendimento.chat_insights (
  id bigserial PRIMARY KEY,
  chat_id bigint REFERENCES atendimento.chats(id) ON DELETE CASCADE,
  stage text,
  sentiment text,
  objecoes text[],
  gargalos text[],
  tags text[],
  summary text,
  nota_atendimento numeric(3,1),
  topico text,
  decisao text,
  classified_at timestamptz DEFAULT now(),
  UNIQUE(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_insights_chat ON atendimento.chat_insights(chat_id);

-- 7. KPI snapshots diários
CREATE TABLE IF NOT EXISTS atendimento.daily_kpi_snapshots (
  date date PRIMARY KEY,
  data jsonb DEFAULT '{}',
  computed_at timestamptz DEFAULT now()
);

-- 8. Copilot memories (para o copiloto do chat)
CREATE TABLE IF NOT EXISTS atendimento.copilot_memories (
  id bigserial PRIMARY KEY,
  chat_id bigint REFERENCES atendimento.chats(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copilot_memories_chat ON atendimento.copilot_memories(chat_id, created_at DESC);

-- 9. RLS policies (seguindo o padrão do projeto)
ALTER TABLE atendimento.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.agent_scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.chat_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.daily_kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimento.copilot_memories ENABLE ROW LEVEL SECURITY;

-- Políticas para service_role (bypass via supabaseAdmin)
CREATE POLICY "service_role_all" ON atendimento.agent_memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON atendimento.knowledge_base FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON atendimento.agent_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON atendimento.agent_scheduled_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON atendimento.chat_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON atendimento.daily_kpi_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON atendimento.copilot_memories FOR ALL USING (true) WITH CHECK (true);
