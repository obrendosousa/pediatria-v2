export type CheckoutItemPayload = {
  product_id?: number | null;
  qty: number;
  type: string;
  name: string;
  price: number;
};

export type PaymentSplitPayload = {
  method: string;
  amount: number;
};

export type SubmitCheckoutParams = {
  appointment_id?: number | null;
  medical_checkout_id?: number | null;
  patient_id?: number | null;
  chat_id?: number | null;
  items: CheckoutItemPayload[];
  payment_method?: string;
  payments?: PaymentSplitPayload[];
  client_total: number;
};

export type CheckoutResult = {
  sale_id: number;
  server_total: number;
  consultation_amount: number;
  store_amount: number;
  tx_atendimento_id: number | null;
  tx_loja_id: number | null;
  idempotent: boolean;
};

export async function submitCheckout(
  params: SubmitCheckoutParams
): Promise<CheckoutResult> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erro ao processar checkout.');
  }

  return data.result as CheckoutResult;
}
