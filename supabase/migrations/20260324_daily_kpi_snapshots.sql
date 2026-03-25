-- ═══════════════════════════════════════════════════════════════
-- Daily KPI Snapshots — raio-X diário da clínica
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_kpi_snapshots (
  date date PRIMARY KEY,

  -- Receita
  receita_confirmada numeric(10,2) DEFAULT 0,
  receita_potencial_perdida numeric(10,2) DEFAULT 0,
  ticket_medio numeric(10,2) DEFAULT 0,
  agendamentos_novos int DEFAULT 0,
  agendamentos_retorno int DEFAULT 0,

  -- Funil
  novos_contatos int DEFAULT 0,
  chats_com_resposta int DEFAULT 0,
  chats_sem_resposta int DEFAULT 0,
  taxa_resposta numeric(5,2) DEFAULT 0,
  tempo_medio_resposta_min numeric(8,2),
  taxa_conversao numeric(5,2) DEFAULT 0,

  -- Objeções
  objecao_preco int DEFAULT 0,
  objecao_vaga int DEFAULT 0,
  objecao_distancia int DEFAULT 0,
  objecao_especialidade int DEFAULT 0,
  ghosting_pos_preco int DEFAULT 0,

  -- Operacional
  msgs_por_chat_media numeric(5,1) DEFAULT 0,
  chats_fora_horario int DEFAULT 0,
  urgencias_identificadas int DEFAULT 0,
  urgencias_atendidas int DEFAULT 0,

  -- Crescimento
  sentimento_positivo int DEFAULT 0,
  sentimento_neutro int DEFAULT 0,
  sentimento_negativo int DEFAULT 0,

  -- Meta
  total_chats_analisados int DEFAULT 0,
  total_mensagens int DEFAULT 0,
  computed_at timestamptz DEFAULT now(),

  -- Detalhes em JSON para drill-down
  details jsonb DEFAULT '{}'
);

-- Expandir chat_insights para classificação automática
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS desfecho text;
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS citacao_chave text;
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS classified_at timestamptz;
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS classified_by text DEFAULT 'manual';
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS message_count_at_classification int;
ALTER TABLE chat_insights ADD COLUMN IF NOT EXISTS needs_reclassification boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_chat_insights_classified ON chat_insights(classified_at) WHERE classified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_insights_needs_reclass ON chat_insights(needs_reclassification) WHERE needs_reclassification = true;
CREATE INDEX IF NOT EXISTS idx_chat_insights_categoria ON chat_insights(categoria) WHERE categoria IS NOT NULL;
