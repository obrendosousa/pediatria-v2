export type InvoiceStatus =
  | 'processing'
  | 'issued'
  | 'denied'
  | 'error'
  | 'cancelled'
  | 'requesting_auth';

export interface TaxpayerAddress {
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
}

export interface Invoice {
  id: number;
  patient_id: number;
  taxpayer_doc?: string;
  taxpayer_name?: string;
  taxpayer_email?: string;
  taxpayer_address?: TaxpayerAddress;
  service_description: string;
  notes?: string;
  amount: number;
  tax_inss: number;
  tax_ir: number;
  tax_cofins: number;
  tax_pis: number;
  tax_csll: number;
  service_code?: string;
  generated_by?: string;
  iss_retained: boolean;
  send_by_email: boolean;
  status: InvoiceStatus;
  nfe_number?: string;
  issued_at?: string;
  created_at: string;
  // JOIN field
  patient_name?: string;
}
