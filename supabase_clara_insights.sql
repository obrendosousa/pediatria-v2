ALTER TABLE public.chat_insights 
ADD COLUMN IF NOT EXISTS nota_atendimento integer NULL,
ADD COLUMN IF NOT EXISTS gargalos text[] NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS resumo_analise text NULL,
ADD COLUMN IF NOT EXISTS metricas_extras jsonb NULL DEFAULT '{}';
