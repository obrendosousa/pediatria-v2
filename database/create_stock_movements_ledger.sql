-- Ledger de movimentações de estoque (almoxarifado xerife)
-- Fonte histórica de entradas/saídas/ajustes para rastreabilidade e auditoria.

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in', 'sale_out', 'adjustment', 'loss', 'return_in', 'return_out', 'transfer')),
  quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidade: se a tabela já existir com schema antigo,
-- garante que as colunas usadas neste script existam antes dos índices.
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS product_id BIGINT,
  ADD COLUMN IF NOT EXISTS movement_type TEXT,
  ADD COLUMN IF NOT EXISTS quantity_change INTEGER,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.stock_movements
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.stock_movements
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

UPDATE public.stock_movements
SET created_at = NOW()
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id_created_at
  ON public.stock_movements(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type
  ON public.stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
  ON public.stock_movements(created_by);
