-- Criação da tabela growth_standards para armazenar dados de referência das curvas de crescimento OMS/CDC
-- Esta tabela armazena todos os dados necessários para calcular z-scores e plotar curvas de crescimento
-- Script idempotente: pode ser executado múltiplas vezes sem erro

CREATE TABLE IF NOT EXISTS public.growth_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metadados da curva
  source TEXT NOT NULL, -- 'WHO' ou 'CDC'
  type TEXT NOT NULL, -- 'wfa', 'lhfa', 'bmifa', 'hcfa', 'wfl', 'wfh'
  gender TEXT NOT NULL, -- 'male' ou 'female'
  age_range TEXT, -- '0_5', '5_10', '5_19' (opcional, para organização)
  
  -- Eixo X (idade ou outra métrica)
  age_months INTEGER, -- Idade em meses (para curvas baseadas em idade)
  x_value NUMERIC, -- Para curvas como peso x altura (altura no eixo X)
  
  -- Parâmetros LMS (para cálculo preciso de z-scores)
  l NUMERIC, -- Lambda (Box-Cox power)
  m NUMERIC, -- Mediana
  s NUMERIC, -- Coeficiente de variação
  
  -- Valores de desvio padrão (para plotagem direta)
  sd0 NUMERIC, -- Mediana (Z=0, P50)
  sd1 NUMERIC, -- +1 SD (Z=1, P84)
  sd2 NUMERIC, -- +2 SD (Z=2, P97)
  sd3 NUMERIC, -- +3 SD (Z=3, P99.9)
  sd_neg1 NUMERIC, -- -1 SD (Z=-1, P16)
  sd_neg2 NUMERIC, -- -2 SD (Z=-2, P3)
  sd_neg3 NUMERIC, -- -3 SD (Z=-3, P0.1)
  
  -- Percentis (alternativa aos SDs, se disponível)
  p3 NUMERIC, -- Percentil 3
  p15 NUMERIC, -- Percentil 15
  p50 NUMERIC, -- Percentil 50 (mediana)
  p85 NUMERIC, -- Percentil 85
  p97 NUMERIC, -- Percentil 97
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar constraint única se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'growth_standards_unique'
  ) THEN
    ALTER TABLE public.growth_standards
    ADD CONSTRAINT growth_standards_unique 
    UNIQUE (source, type, gender, age_months, x_value);
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_growth_standards_lookup 
  ON public.growth_standards(source, type, gender, age_months NULLS LAST, x_value NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_growth_standards_type_gender 
  ON public.growth_standards(type, gender);

-- Comentários para documentação
COMMENT ON TABLE public.growth_standards IS 'Armazena dados de referência das curvas de crescimento da OMS e CDC para cálculo de z-scores e plotagem de gráficos';
COMMENT ON COLUMN public.growth_standards.source IS 'Fonte dos dados: WHO (OMS) ou CDC';
COMMENT ON COLUMN public.growth_standards.type IS 'Tipo de curva: wfa (peso/idade), lhfa (estatura/idade), bmifa (IMC/idade), hcfa (PC/idade), wfl (peso/comprimento), wfh (peso/estatura)';
COMMENT ON COLUMN public.growth_standards.gender IS 'Gênero: male ou female';
COMMENT ON COLUMN public.growth_standards.age_months IS 'Idade em meses (para curvas baseadas em idade)';
COMMENT ON COLUMN public.growth_standards.x_value IS 'Valor do eixo X (para curvas como peso x altura, onde altura é o eixo X)';
COMMENT ON COLUMN public.growth_standards.l IS 'Parâmetro Lambda (Box-Cox power) para cálculo de z-scores';
COMMENT ON COLUMN public.growth_standards.m IS 'Parâmetro Mediana para cálculo de z-scores';
COMMENT ON COLUMN public.growth_standards.s IS 'Parâmetro Coeficiente de Variação para cálculo de z-scores';
COMMENT ON COLUMN public.growth_standards.sd0 IS 'Mediana (Z=0, P50)';
COMMENT ON COLUMN public.growth_standards.sd1 IS '+1 Desvio Padrão (Z=1, P84)';
COMMENT ON COLUMN public.growth_standards.sd2 IS '+2 Desvios Padrão (Z=2, P97)';
COMMENT ON COLUMN public.growth_standards.sd3 IS '+3 Desvios Padrão (Z=3, P99.9)';
COMMENT ON COLUMN public.growth_standards.sd_neg1 IS '-1 Desvio Padrão (Z=-1, P16)';
COMMENT ON COLUMN public.growth_standards.sd_neg2 IS '-2 Desvios Padrão (Z=-2, P3)';
COMMENT ON COLUMN public.growth_standards.sd_neg3 IS '-3 Desvios Padrão (Z=-3, P0.1)';
