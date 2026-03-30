-- RPC: Processa checkout da secretaria em uma unica transacao atomica.
-- Cria sale + sale_items + financial_transactions + deduz estoque FEFO
-- + atualiza medical_checkout + appointment.
-- Se qualquer parte falhar, tudo faz rollback automaticamente.

CREATE OR REPLACE FUNCTION public.process_secretary_checkout(p_params JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Parametros de entrada
  v_appointment_id   BIGINT  := (p_params->>'appointment_id')::BIGINT;
  v_medical_checkout_id BIGINT := (p_params->>'medical_checkout_id')::BIGINT;
  v_created_by       UUID    := (p_params->>'created_by')::UUID;
  v_patient_id       BIGINT  := (p_params->>'patient_id')::BIGINT;
  v_chat_id          BIGINT  := (p_params->>'chat_id')::BIGINT;
  v_payment_method   TEXT    := p_params->>'payment_method';
  v_payments         JSONB   := p_params->'payments';
  v_items            JSONB   := p_params->'items';
  v_client_total     NUMERIC := COALESCE((p_params->>'client_total')::NUMERIC, 0);

  -- Variaveis internas
  v_now              TIMESTAMPTZ := NOW();
  v_sale_id          BIGINT;
  v_existing_sale_id BIGINT;
  v_server_total     NUMERIC := 0;
  v_consultation_amount NUMERIC := 0;
  v_store_amount     NUMERIC := 0;
  v_debt_amount      NUMERIC := 0;
  v_dominant_origin  TEXT;
  v_sale_payment_method TEXT;
  v_tx_atendimento_id BIGINT;
  v_tx_loja_id       BIGINT;

  -- Appointment
  v_apt_total_amount   NUMERIC;
  v_apt_discount_amount NUMERIC;
  v_apt_amount_paid    NUMERIC;
  v_apt_effective_total NUMERIC;
  v_safe_debt_amount   NUMERIC;
  v_next_amount_paid   NUMERIC;

  -- Iteracao JSONB (items de entrada)
  v_item             JSONB;
  v_db_price         NUMERIC;
  v_db_active        BOOLEAN;
  v_item_product_id  BIGINT;
  v_item_qty         INTEGER;
  v_item_type        TEXT;
  v_item_price       NUMERIC;
  v_item_name        TEXT;
  v_available_stock  INTEGER;

  -- Iteracao sobre tabela temporaria (RECORD)
  v_ci               RECORD;

  -- FEFO
  v_batch            RECORD;
  v_qty_need         INTEGER;
  v_take             INTEGER;
  v_remaining_stock  INTEGER;

  -- Payment splits
  v_pay              JSONB;
  v_pay_method       TEXT;
  v_pay_amount       NUMERIC;
  v_pay_sum          NUMERIC := 0;
  v_split_count      INTEGER := 0;
  v_canonical_method TEXT;

  -- Proporcional split tracking (correcao de arredondamento)
  v_split_idx        INTEGER;
  v_split_total      INTEGER;
  v_split_accumulated NUMERIC;
  v_split_target     NUMERIC;
BEGIN
  -- ============================================================
  -- 0. IDEMPOTENCIA: verificar se ja existe sale para este appointment
  -- ============================================================
  IF v_appointment_id IS NOT NULL THEN
    SELECT id INTO v_existing_sale_id
    FROM public.sales
    WHERE appointment_id = v_appointment_id
      AND status = 'completed'
    LIMIT 1;

    IF v_existing_sale_id IS NOT NULL THEN
      -- Sale ja existe, apenas garantir que appointment esta finished
      UPDATE public.appointments
      SET status = 'finished'
      WHERE id = v_appointment_id AND status <> 'finished';

      RETURN jsonb_build_object(
        'sale_id', v_existing_sale_id,
        'idempotent', true
      );
    END IF;
  ELSIF v_medical_checkout_id IS NOT NULL THEN
    -- Idempotencia por medical_checkout_id quando nao ha appointment
    SELECT s.id INTO v_existing_sale_id
    FROM public.financial_transactions ft
    JOIN public.sales s ON s.id = ft.sale_id
    WHERE ft.medical_checkout_id = v_medical_checkout_id
      AND s.status = 'completed'
    LIMIT 1;

    IF v_existing_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'sale_id', v_existing_sale_id,
        'idempotent', true
      );
    END IF;
  END IF;

  -- ============================================================
  -- 1. VALIDAR E RECALCULAR PRECOS DOS PRODUTOS (server-side)
  -- ============================================================
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio. Nenhum item para processar.';
  END IF;

  -- Criar tabela temporaria para itens validados (drop previo evita colisao em connection pooling)
  DROP TABLE IF EXISTS _checkout_items;
  CREATE TEMPORARY TABLE _checkout_items (
    product_id  BIGINT,
    qty         INTEGER NOT NULL,
    item_type   TEXT NOT NULL,
    item_name   TEXT NOT NULL,
    unit_price  NUMERIC(12,2) NOT NULL,
    line_total  NUMERIC(12,2) NOT NULL
  ) ON COMMIT DROP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_item_product_id := (v_item->>'product_id')::BIGINT;
    v_item_qty        := (v_item->>'qty')::INTEGER;
    v_item_type       := COALESCE(v_item->>'type', 'product');
    v_item_name       := COALESCE(v_item->>'name', 'Item');
    v_item_price      := COALESCE((v_item->>'price')::NUMERIC, 0);

    IF v_item_qty IS NULL OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Quantidade invalida para o item: %', v_item_name;
    END IF;

    -- Itens de divida (saldo restante) e consulta nao tem produto no DB
    IF v_item_type IN ('debt', 'medical_item') AND v_item_product_id IS NULL THEN
      INSERT INTO _checkout_items (product_id, qty, item_type, item_name, unit_price, line_total)
      VALUES (NULL, v_item_qty, v_item_type, v_item_name, v_item_price, ROUND(v_item_price * v_item_qty, 2));
    ELSE
      -- Re-validar preco e status do produto no banco
      SELECT price_sale, active INTO v_db_price, v_db_active
      FROM public.products
      WHERE id = v_item_product_id;

      IF v_db_price IS NULL THEN
        RAISE EXCEPTION 'Produto ID % nao encontrado.', v_item_product_id;
      END IF;

      IF v_db_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Produto ID % nao esta ativo para venda.', v_item_product_id;
      END IF;

      INSERT INTO _checkout_items (product_id, qty, item_type, item_name, unit_price, line_total)
      VALUES (v_item_product_id, v_item_qty, v_item_type, v_item_name, v_db_price, ROUND(v_db_price * v_item_qty, 2));
    END IF;
  END LOOP;

  -- Calcular total server-side
  SELECT COALESCE(SUM(line_total), 0) INTO v_server_total FROM _checkout_items;

  IF v_server_total <= 0 THEN
    RAISE EXCEPTION 'Total da venda deve ser maior que zero. Total calculado: %', v_server_total;
  END IF;

  -- Verificar divergencia com total do cliente (tolerancia de R$0.02 por item para arredondamento)
  IF ABS(v_server_total - v_client_total) > 0.02 * jsonb_array_length(v_items) THEN
    RAISE EXCEPTION 'Divergencia de preco detectada. Total cliente: %, Total servidor: %. Os precos podem ter sido alterados.', v_client_total, v_server_total;
  END IF;

  -- Calcular subtotais por origem
  SELECT COALESCE(SUM(line_total), 0) INTO v_debt_amount
  FROM _checkout_items WHERE item_type = 'debt';

  SELECT COALESCE(SUM(line_total), 0) INTO v_consultation_amount
  FROM _checkout_items WHERE item_type = 'debt' OR (item_type = 'medical_item' AND product_id IS NULL);

  SELECT COALESCE(SUM(line_total), 0) INTO v_store_amount
  FROM _checkout_items WHERE item_type IN ('product', 'service') OR (item_type = 'medical_item' AND product_id IS NOT NULL);

  IF v_store_amount > v_consultation_amount THEN
    v_dominant_origin := 'loja';
  ELSE
    v_dominant_origin := 'atendimento';
  END IF;

  -- ============================================================
  -- 2. PRE-VALIDAR ESTOQUE DE TODOS OS PRODUTOS
  -- ============================================================
  FOR v_ci IN
    SELECT ci.product_id, SUM(ci.qty)::INTEGER AS total_qty, MIN(ci.item_name) AS item_name
    FROM _checkout_items ci
    WHERE ci.product_id IS NOT NULL AND ci.item_type IN ('product', 'service', 'medical_item')
    GROUP BY ci.product_id
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_available_stock
    FROM public.product_batches
    WHERE product_id = v_ci.product_id
      AND quantity > 0;

    IF v_available_stock < v_ci.total_qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto "%". Disponivel: %, Necessario: %',
        v_ci.item_name, v_available_stock, v_ci.total_qty;
    END IF;
  END LOOP;

  -- ============================================================
  -- 3. VALIDAR FORMAS DE PAGAMENTO
  -- ============================================================
  IF v_payments IS NOT NULL AND jsonb_typeof(v_payments) = 'array' AND jsonb_array_length(v_payments) > 0 THEN
    FOR v_pay IN SELECT * FROM jsonb_array_elements(v_payments)
    LOOP
      v_pay_method := v_pay->>'method';
      v_pay_amount := ROUND((v_pay->>'amount')::NUMERIC, 2);

      IF v_pay_amount <= 0 THEN
        RAISE EXCEPTION 'Valor da forma de pagamento deve ser maior que zero.';
      END IF;

      -- Normalizar metodo
      v_canonical_method := CASE LOWER(TRIM(v_pay_method))
        WHEN 'pix' THEN 'pix'
        WHEN 'cash' THEN 'cash'
        WHEN 'dinheiro' THEN 'cash'
        WHEN 'money' THEN 'cash'
        WHEN 'debit_card' THEN 'debit_card'
        WHEN 'debit' THEN 'debit_card'
        WHEN 'debito' THEN 'debit_card'
        WHEN 'cartao_debito' THEN 'debit_card'
        WHEN 'credit_card' THEN 'credit_card'
        WHEN 'credit' THEN 'credit_card'
        WHEN 'card' THEN 'credit_card'
        WHEN 'cartao' THEN 'credit_card'
        WHEN 'cartao_credito' THEN 'credit_card'
        ELSE NULL
      END;

      IF v_canonical_method IS NULL THEN
        RAISE EXCEPTION 'Forma de pagamento invalida: %', v_pay_method;
      END IF;

      v_pay_sum := v_pay_sum + v_pay_amount;
      v_split_count := v_split_count + 1;
    END LOOP;

    IF ABS(v_pay_sum - v_server_total) > 0.01 THEN
      RAISE EXCEPTION 'Soma das formas de pagamento (%) diferente do total (%).', v_pay_sum, v_server_total;
    END IF;

    IF v_split_count > 1 THEN
      v_sale_payment_method := 'mixed';
    ELSE
      v_sale_payment_method := v_canonical_method;
    END IF;
  ELSE
    -- Pagamento unico
    IF v_payment_method IS NULL OR v_payment_method = '' THEN
      RAISE EXCEPTION 'Informe a forma de pagamento.';
    END IF;

    v_canonical_method := CASE LOWER(TRIM(v_payment_method))
      WHEN 'pix' THEN 'pix'
      WHEN 'cash' THEN 'cash'
      WHEN 'dinheiro' THEN 'cash'
      WHEN 'money' THEN 'cash'
      WHEN 'debit_card' THEN 'debit_card'
      WHEN 'debit' THEN 'debit_card'
      WHEN 'debito' THEN 'debit_card'
      WHEN 'cartao_debito' THEN 'debit_card'
      WHEN 'credit_card' THEN 'credit_card'
      WHEN 'credit' THEN 'credit_card'
      WHEN 'card' THEN 'credit_card'
      WHEN 'cartao' THEN 'credit_card'
      WHEN 'cartao_credito' THEN 'credit_card'
      ELSE NULL
    END;

    IF v_canonical_method IS NULL THEN
      RAISE EXCEPTION 'Forma de pagamento invalida: %', v_payment_method;
    END IF;

    v_sale_payment_method := v_canonical_method;
    v_pay_sum := v_server_total;
    v_split_count := 1;
  END IF;

  -- ============================================================
  -- 4. CRIAR REGISTRO DA VENDA (sales)
  -- ============================================================
  INSERT INTO public.sales (
    chat_id, patient_id, total, status, payment_method,
    created_by, origin, appointment_id, created_at
  ) VALUES (
    v_chat_id, v_patient_id, v_server_total, 'completed',
    v_sale_payment_method, v_created_by, v_dominant_origin,
    v_appointment_id, v_now
  ) RETURNING id INTO v_sale_id;

  -- ============================================================
  -- 5. INSERIR ITENS DA VENDA (sale_items)
  -- ============================================================
  INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price)
  SELECT v_sale_id, ci.product_id, ci.qty, ci.unit_price
  FROM _checkout_items ci;

  -- ============================================================
  -- 6. DEDUZIR ESTOQUE (FEFO) + STOCK MOVEMENTS
  -- ============================================================
  FOR v_ci IN
    SELECT ci.product_id, ci.qty, ci.item_name, ci.unit_price
    FROM _checkout_items ci
    WHERE ci.product_id IS NOT NULL AND ci.item_type IN ('product', 'service', 'medical_item')
  LOOP
    v_qty_need := v_ci.qty;
    v_item_product_id := v_ci.product_id;

    FOR v_batch IN
      SELECT id, quantity
      FROM public.product_batches
      WHERE product_id = v_item_product_id AND quantity > 0
      ORDER BY expiration_date ASC
    LOOP
      EXIT WHEN v_qty_need <= 0;

      v_take := LEAST(v_batch.quantity, v_qty_need);

      UPDATE public.product_batches
      SET quantity = quantity - v_take
      WHERE id = v_batch.id;

      -- Registrar movimentacao de estoque
      INSERT INTO public.stock_movements (
        product_id, movement_type, quantity_change, reason,
        reference_type, reference_id, metadata, created_by, created_at
      ) VALUES (
        v_item_product_id, 'sale_out', -v_take,
        'Baixa de estoque por checkout de consulta',
        'sale', v_sale_id::TEXT,
        jsonb_build_object('sale_id', v_sale_id, 'batch_id', v_batch.id, 'unit_price', v_ci.unit_price),
        v_created_by, v_now
      );

      v_qty_need := v_qty_need - v_take;
    END LOOP;

    -- Sincronizar products.stock com soma dos batches restantes
    SELECT COALESCE(SUM(quantity), 0) INTO v_remaining_stock
    FROM public.product_batches
    WHERE product_id = v_item_product_id AND quantity > 0;

    UPDATE public.products
    SET stock = v_remaining_stock
    WHERE id = v_item_product_id;
  END LOOP;

  -- ============================================================
  -- 7. CRIAR TRANSACOES FINANCEIRAS (split atendimento/loja)
  -- ============================================================
  IF v_consultation_amount > 0 THEN
    INSERT INTO public.financial_transactions (
      amount, origin, created_by, occurred_at,
      appointment_id, sale_id, medical_checkout_id, created_at
    ) VALUES (
      v_consultation_amount, 'atendimento', v_created_by, v_now,
      v_appointment_id, v_sale_id, v_medical_checkout_id, v_now
    ) RETURNING id INTO v_tx_atendimento_id;

    -- Inserir payment splits para transacao atendimento
    -- Usa logica "ultimo absorve diferenca" para evitar perda de centavos por arredondamento
    IF v_payments IS NOT NULL AND jsonb_typeof(v_payments) = 'array' AND jsonb_array_length(v_payments) > 0 THEN
      v_split_idx := 0;
      v_split_total := jsonb_array_length(v_payments);
      v_split_accumulated := 0;

      FOR v_pay IN SELECT * FROM jsonb_array_elements(v_payments)
      LOOP
        v_split_idx := v_split_idx + 1;
        v_canonical_method := CASE LOWER(TRIM(v_pay->>'method'))
          WHEN 'pix' THEN 'pix'
          WHEN 'cash' THEN 'cash' WHEN 'dinheiro' THEN 'cash' WHEN 'money' THEN 'cash'
          WHEN 'debit_card' THEN 'debit_card' WHEN 'debit' THEN 'debit_card' WHEN 'debito' THEN 'debit_card' WHEN 'cartao_debito' THEN 'debit_card'
          WHEN 'credit_card' THEN 'credit_card' WHEN 'credit' THEN 'credit_card' WHEN 'card' THEN 'credit_card' WHEN 'cartao' THEN 'credit_card' WHEN 'cartao_credito' THEN 'credit_card'
        END;

        IF v_split_idx = v_split_total THEN
          -- Ultimo split absorve a diferenca de arredondamento
          v_pay_amount := v_consultation_amount - v_split_accumulated;
        ELSE
          v_pay_amount := ROUND((v_pay->>'amount')::NUMERIC * (v_consultation_amount / v_server_total), 2);
          v_split_accumulated := v_split_accumulated + v_pay_amount;
        END IF;

        IF v_pay_amount > 0 THEN
          INSERT INTO public.financial_transaction_payments (transaction_id, payment_method, amount)
          VALUES (v_tx_atendimento_id, v_canonical_method, v_pay_amount);
        END IF;
      END LOOP;
    ELSE
      INSERT INTO public.financial_transaction_payments (transaction_id, payment_method, amount)
      VALUES (v_tx_atendimento_id, v_canonical_method, v_consultation_amount);
    END IF;
  END IF;

  IF v_store_amount > 0 THEN
    INSERT INTO public.financial_transactions (
      amount, origin, created_by, occurred_at,
      appointment_id, sale_id, medical_checkout_id, created_at
    ) VALUES (
      v_store_amount, 'loja', v_created_by, v_now,
      v_appointment_id, v_sale_id, v_medical_checkout_id, v_now
    ) RETURNING id INTO v_tx_loja_id;

    -- Inserir payment splits para transacao loja (mesmo padrao de arredondamento)
    IF v_payments IS NOT NULL AND jsonb_typeof(v_payments) = 'array' AND jsonb_array_length(v_payments) > 0 THEN
      v_split_idx := 0;
      v_split_total := jsonb_array_length(v_payments);
      v_split_accumulated := 0;

      FOR v_pay IN SELECT * FROM jsonb_array_elements(v_payments)
      LOOP
        v_split_idx := v_split_idx + 1;
        v_canonical_method := CASE LOWER(TRIM(v_pay->>'method'))
          WHEN 'pix' THEN 'pix'
          WHEN 'cash' THEN 'cash' WHEN 'dinheiro' THEN 'cash' WHEN 'money' THEN 'cash'
          WHEN 'debit_card' THEN 'debit_card' WHEN 'debit' THEN 'debit_card' WHEN 'debito' THEN 'debit_card' WHEN 'cartao_debito' THEN 'debit_card'
          WHEN 'credit_card' THEN 'credit_card' WHEN 'credit' THEN 'credit_card' WHEN 'card' THEN 'credit_card' WHEN 'cartao' THEN 'credit_card' WHEN 'cartao_credito' THEN 'credit_card'
        END;

        IF v_split_idx = v_split_total THEN
          v_pay_amount := v_store_amount - v_split_accumulated;
        ELSE
          v_pay_amount := ROUND((v_pay->>'amount')::NUMERIC * (v_store_amount / v_server_total), 2);
          v_split_accumulated := v_split_accumulated + v_pay_amount;
        END IF;

        IF v_pay_amount > 0 THEN
          INSERT INTO public.financial_transaction_payments (transaction_id, payment_method, amount)
          VALUES (v_tx_loja_id, v_canonical_method, v_pay_amount);
        END IF;
      END LOOP;
    ELSE
      INSERT INTO public.financial_transaction_payments (transaction_id, payment_method, amount)
      VALUES (v_tx_loja_id, v_canonical_method, v_store_amount);
    END IF;
  END IF;

  -- ============================================================
  -- 8. ATUALIZAR MEDICAL CHECKOUT (se houver)
  -- ============================================================
  IF v_medical_checkout_id IS NOT NULL THEN
    UPDATE public.medical_checkouts
    SET status = 'completed', completed_at = v_now
    WHERE id = v_medical_checkout_id;
  END IF;

  -- ============================================================
  -- 9. ATUALIZAR APPOINTMENT (status + amount_paid com overpayment guard)
  -- ============================================================
  IF v_appointment_id IS NOT NULL THEN
    SELECT
      COALESCE(total_amount, 0),
      COALESCE(discount_amount, 0),
      COALESCE(amount_paid, 0)
    INTO v_apt_total_amount, v_apt_discount_amount, v_apt_amount_paid
    FROM public.appointments
    WHERE id = v_appointment_id;

    v_apt_effective_total := GREATEST(0, v_apt_total_amount - v_apt_discount_amount);
    v_safe_debt_amount := LEAST(v_debt_amount, GREATEST(0, v_apt_effective_total - v_apt_amount_paid));

    -- Overpayment guard: se effective_total = 0 (consulta gratis), amount_paid fica como esta
    IF v_apt_effective_total = 0 THEN
      v_next_amount_paid := v_apt_amount_paid;
    ELSE
      v_next_amount_paid := LEAST(v_apt_amount_paid + v_safe_debt_amount, v_apt_effective_total);
    END IF;

    UPDATE public.appointments
    SET status = 'finished',
        amount_paid = v_next_amount_paid
    WHERE id = v_appointment_id;
  END IF;

  -- ============================================================
  -- 10. RETORNAR RESULTADO
  -- ============================================================
  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'server_total', v_server_total,
    'consultation_amount', v_consultation_amount,
    'store_amount', v_store_amount,
    'tx_atendimento_id', v_tx_atendimento_id,
    'tx_loja_id', v_tx_loja_id,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_secretary_checkout(JSONB) TO authenticated;
