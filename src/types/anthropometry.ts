// Tipos para o módulo de antropometria e curvas de crescimento pediátrico

export interface AnthropometryEntry {
  id?: number;
  patient_id: number;
  appointment_id?: number | null;
  medical_record_id?: number | null;
  measurement_date: string; // ISO date (YYYY-MM-DD)
  weight_kg?: number | null;
  height_cm?: number | null;
  head_circumference_cm?: number | null;
  bmi?: number | null; // Calculado automaticamente
  is_premature: boolean;
  gestational_age_weeks?: number | null; // Idade gestacional ao nascer (se prematuro)
  notes?: string | null;
  created_at?: string;
  created_by?: number | null;
}

// --- NOVOS TIPOS PARA O BANCO DE DADOS (Baseado no seu CSV) ---
export interface GrowthStandardRow {
  id: string; // UUID vindo do banco
  source: 'WHO' | 'CDC';
  type: 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh';
  gender: 'male' | 'female';
  age_range: string; // ex: '0_5', '2_20'
  age_months: number | null;
  x_value: number | null; // Para gráficos peso x estatura
  
  // Colunas de Z-Score (Do CSV)
  sd_neg3: number;
  sd_neg2: number;
  sd_neg1: number;
  sd0: number; // Média
  sd1: number;
  sd2: number;
  sd3: number;

  // Colunas de Percentil (Do CSV)
  p3: number;
  p15: number;
  p50: number; // Mediana
  p85: number;
  p97: number;
}
// -----------------------------------------------------------

export type ChartReference = 'WHO' | 'CDC';
export type DisplayMode = 'PERCENTILE' | 'Z_SCORE';

// Configuração usada para buscar os dados corretos
export interface ChartConfig {
  reference: ChartReference;
  metric: string; // 'wfa' | 'lhfa' etc
  ageRange: string; // '0_5' | '2_20'
  displayMode: DisplayMode;
  gender: 'male' | 'female';
}

export interface ReferenceLine {
  label: string; // ex: "P50" ou "Z0"
  color: string;
  data: { x: number; y: number }[]; // Pontos que formam a curva
}

export interface GrowthChartData {
  patientPoints: { 
    x: number; 
    y: number; 
    date: string; 
    entryId: number;
    // Metadados para tooltip
    weight?: number | null;
    height?: number | null;
    bmi?: number | null;
  }[];
  referenceLines: ReferenceLine[];
}

export interface ChartOption {
  label: string;
  value: string;
  description?: string;
}