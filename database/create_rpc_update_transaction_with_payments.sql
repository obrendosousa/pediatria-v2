-- RPC: Atualiza transação financeira + formas de pagamento em uma única transação atômica.
-- Se qualquer parte falhar, tudo faz rollback automaticamente.

CREATE OR REPLACE FUNCTION public.update_transaction_with_payments(
  p_transaction_id BIGINT,
  p_updates JSONB,
  p_payments JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 1. Atualizar transação principal
  UPDATE public.financial_transactions
  SET
    amount = COALESCE((p_updates->>'amount')::NUMERIC, amount),
    origin = COALESCE(p_updates->>'origin', origin),
    occurred_at = COALESCE((p_updates->>'occurred_at')::TIMESTAMPTZ, occurred_at),
    notes = CASE
      WHEN p_updates ? 'notes' THEN p_updates->>'notes'
      ELSE notes
    END
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação % não encontrada.', p_transaction_id;
  END IF;

  -- 2. Remover pagamentos antigos
  DELETE FROM public.financial_transaction_payments
  WHERE transaction_id = p_transaction_id;

  -- 3. Inserir novos pagamentos
  INSERT INTO public.financial_transaction_payments (transaction_id, payment_method, amount)
  SELECT
    p_transaction_id,
    item->>'payment_method',
    (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(p_payments) AS item;

  -- 4. Retornar transação atualizada com pagamentos
  SELECT jsonb_build_object(
    'id', ft.id,
    'amount', ft.amount,
    'origin', ft.origin,
    'occurred_at', ft.occurred_at,
    'notes', ft.notes,
    'financial_transaction_payments', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'payment_method', ftp.payment_method,
        'amount', ftp.amount
      ))
      FROM public.financial_transaction_payments ftp
      WHERE ftp.transaction_id = ft.id),
      '[]'::jsonb
    )
  ) INTO v_result
  FROM public.financial_transactions ft
  WHERE ft.id = p_transaction_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transaction_with_payments(BIGINT, JSONB, JSONB) TO authenticated;
