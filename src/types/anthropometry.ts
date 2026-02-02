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

export type ChartReference = 'WHO' | 'CDC' | 'DOWNSYNDROME_UNICAMP';
export type ChartMetric = 'WEIGHT_AGE' | 'HEIGHT_AGE' | 'BMI_AGE' | 'HEAD_AGE' | 'WEIGHT_HEIGHT';
export type ChartAgeRange = '0_5' | '5_10' | '5_19';
export type DisplayMode = 'PERCENTILE' | 'Z_SCORE';

export interface ChartConfig {
  reference: ChartReference;
  metric: ChartMetric;
  ageRange: ChartAgeRange;
  displayMode: DisplayMode;
}

export interface ReferenceLine {
  label: string; // ex: "P50" ou "Z0"
  color: string;
  data: { x: number; y: number }[]; // Pontos que formam a curva (x = idade em meses, y = valor)
}

export interface GrowthChartData {
  patientPoints: { x: number; y: number; date: string; entryId: number }[];
  referenceLines: ReferenceLine[];
}

// Opções de curva disponíveis no dropdown
export interface ChartOption {
  label: string;
  value: string;
  reference: ChartReference;
  metric: ChartMetric;
  ageRange: ChartAgeRange;
  description?: string;
}
