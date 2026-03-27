// Utilitários para cálculos de antropometria e curvas de crescimento

import React from 'react';
import {
  differenceInMonths, differenceInDays, differenceInYears,
  parseISO, isValid, addYears, addMonths,
} from 'date-fns';

/**
 * Calcula a idade em meses decimais entre duas datas
 */
export function calculateAgeInMonths(
  birthDate: string | Date,
  measurementDate: string | Date
): number {
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const measurement = typeof measurementDate === 'string' ? parseISO(measurementDate) : measurementDate;

  if (!isValid(birth) || !isValid(measurement)) {
    return 0;
  }

  const months = differenceInMonths(measurement, birth);
  const days = differenceInDays(measurement, birth) % 30;

  return months + (days / 30);
}

/**
 * Calcula a idade corrigida para prematuros
 */
export function calculateCorrectedAge(
  birthDate: string | Date,
  gestationalAgeWeeks: number,
  measurementDate: string | Date
): number | null {
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const measurement = typeof measurementDate === 'string' ? parseISO(measurementDate) : measurementDate;

  if (!isValid(birth) || !isValid(measurement)) {
    return null;
  }

  const chronologicalAgeMonths = calculateAgeInMonths(birth, measurement);

  if (chronologicalAgeMonths >= 24) {
    return chronologicalAgeMonths;
  }

  const weeksPremature = 40 - gestationalAgeWeeks;
  const monthsPremature = weeksPremature / 4.33;
  const correctedAge = chronologicalAgeMonths - monthsPremature;

  return Math.max(0, correctedAge);
}

/**
 * Calcula o IMC (Índice de Massa Corporal)
 */
export function calculateBMI(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);

  return Math.round(bmi * 100) / 100;
}

/**
 * Calcula a idade precisa entre duas datas no formato "X ano(s), Y mês(es) e Z dia(s)"
 */
export function calculatePreciseAgeBetweenDates(
  birthDate: string | Date,
  targetDate: string | Date
): string {
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;

  if (!isValid(birth) || !isValid(target)) return '—';

  const years = differenceInYears(target, birth);
  const afterYears = addYears(birth, years);
  const months = differenceInMonths(target, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(target, afterMonths);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);

  if (parts.length === 0) return 'Recém-nascido';
  if (parts.length > 1) {
    const last = parts.pop();
    return `${parts.join(', ')} e ${last}`;
  }
  return parts[0];
}

/**
 * Formata a idade em meses para exibição no eixo X do gráfico
 */
export function formatChartLabel(ageMonths: number): string {
  if (ageMonths === 0) {
    return 'Nasc.';
  }

  const years = Math.floor(ageMonths / 12);
  const months = Math.floor(ageMonths % 12);

  if (years === 0) {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  if (months === 0) {
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }

  return `${years} ${years === 1 ? 'ano' : 'anos'} ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

/**
 * Formata label simplificado para eixo X (apenas anos principais)
 */
export function formatChartLabelSimple(ageMonths: number): string {
  if (ageMonths === 0) {
    return 'Nasc.';
  }

  const years = Math.floor(ageMonths / 12);

  if (years === 0) {
    return `${Math.floor(ageMonths)}m`;
  }

  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}

/**
 * Formata label do eixo X no padrão iClinic:
 * - Nasc. para 0 meses
 * - "1 ano", "2 anos" para anos exatos
 * - Número do mês residual (1-11) para meses intermediários
 * - Para altura: "XX cm"
 */
export function formatXAxisLabel(ageMonths: number, isLength?: boolean): string {
  if (isLength) {
    return `${Math.round(ageMonths)} cm`;
  }

  if (ageMonths === 0) return 'Nasc.';

  const years = Math.floor(ageMonths / 12);
  const months = Math.round(ageMonths % 12);

  if (months === 0) {
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }

  if (years === 0) {
    return `${months}`;
  }

  return `${months}`;
}

/**
 * Gera array de ticks mensais de 0 até maxMonths para o eixo X do gráfico
 */
export function generateMonthlyTicks(minMonths: number, maxMonths: number): number[] {
  const ticks: number[] = [];
  const start = Math.ceil(minMonths);
  const end = Math.floor(maxMonths);
  for (let i = start; i <= end; i++) {
    ticks.push(i);
  }
  return ticks;
}

/**
 * Determina a fonte de dados (WHO ou CDC) baseado na idade do paciente
 */
export function determineSource(ageMonths: number): 'WHO' | 'CDC' {
  return ageMonths <= 24 ? 'WHO' : 'CDC';
}

/**
 * Exporta um elemento HTML (gráfico) como PNG
 */
export async function exportChartToPNG(
  elementRef: React.RefObject<HTMLElement> | HTMLElement | null,
  filename: string = 'curva-crescimento'
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Export PNG só está disponível no navegador');
  }

  let html2canvas: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  try {
    html2canvas = (await import('html2canvas')).default;
  } catch {
    console.warn('html2canvas não está disponível. Instale com: npm install html2canvas');
    throw new Error('Biblioteca html2canvas não está instalada. Execute: npm install html2canvas');
  }

  const element = elementRef && 'current' in elementRef ? elementRef.current : elementRef;

  if (!element) {
    throw new Error('Elemento não encontrado para exportação');
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
    });

    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        throw new Error('Erro ao criar imagem');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (exportError) {
    console.error('Erro ao exportar gráfico:', exportError);
    throw exportError;
  }
}

/**
 * Valida se os valores de entrada são razoáveis
 */
export function validateAnthropometryInputs(
  weightKg?: number | null,
  heightCm?: number | null,
  headCircumferenceCm?: number | null
): { field: string; message: string } | null {
  if (weightKg !== null && weightKg !== undefined) {
    if (weightKg < 0.5 || weightKg > 200) {
      return { field: 'weight', message: 'Peso deve estar entre 0.5kg e 200kg' };
    }
  }

  if (heightCm !== null && heightCm !== undefined) {
    if (heightCm < 30 || heightCm > 250) {
      return { field: 'height', message: 'Altura deve estar entre 30cm e 250cm' };
    }
  }

  if (headCircumferenceCm !== null && headCircumferenceCm !== undefined) {
    if (headCircumferenceCm < 20 || headCircumferenceCm > 70) {
      return { field: 'headCircumference', message: 'Perímetro cefálico deve estar entre 20cm e 70cm' };
    }
  }

  return null;
}
