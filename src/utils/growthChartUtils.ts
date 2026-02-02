// Utilitários para cálculos de antropometria e curvas de crescimento

import React from 'react';
import { differenceInMonths, differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * Calcula a idade em meses decimais entre duas datas
 * @param birthDate Data de nascimento (ISO string ou Date)
 * @param measurementDate Data da medição (ISO string ou Date)
 * @returns Idade em meses com decimais (ex: 12.5 = 12 meses e 15 dias)
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
  const days = differenceInDays(measurement, birth) % 30; // Aproximação: 30 dias = 1 mês
  
  return months + (days / 30);
}

/**
 * Calcula a idade corrigida para prematuros
 * Idade corrigida = Idade cronológica - (40 semanas - Idade gestacional ao nascer)
 * Aplicar apenas até 2 anos de idade cronológica
 * @param birthDate Data de nascimento
 * @param gestationalAgeWeeks Idade gestacional ao nascer em semanas
 * @param measurementDate Data da medição
 * @returns Idade corrigida em meses, ou null se não aplicável
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

  // Calcular idade cronológica em meses
  const chronologicalAgeMonths = calculateAgeInMonths(birth, measurement);

  // Aplicar correção apenas até 2 anos (24 meses)
  if (chronologicalAgeMonths >= 24) {
    return chronologicalAgeMonths; // Após 2 anos, usar idade cronológica
  }

  // Calcular semanas de prematuridade
  const weeksPremature = 40 - gestationalAgeWeeks;
  
  // Converter semanas para meses (aproximação: 4.33 semanas = 1 mês)
  const monthsPremature = weeksPremature / 4.33;

  // Idade corrigida = idade cronológica - meses de prematuridade
  const correctedAge = chronologicalAgeMonths - monthsPremature;

  return Math.max(0, correctedAge); // Não pode ser negativo
}

/**
 * Calcula o IMC (Índice de Massa Corporal)
 * @param weightKg Peso em quilogramas
 * @param heightCm Altura em centímetros
 * @returns IMC calculado ou null se dados inválidos
 */
export function calculateBMI(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);
  
  return Math.round(bmi * 100) / 100; // Arredondar para 2 casas decimais
}

/**
 * Formata a idade em meses para exibição no eixo X do gráfico
 * @param ageMonths Idade em meses
 * @returns String formatada (ex: "Nasc.", "1 ano", "2 anos")
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
 * @param ageMonths Idade em meses
 * @returns String simplificada (ex: "Nasc.", "1 ano", "2 anos")
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
 * Formata label do eixo X de forma responsiva baseado na idade
 * @param ageMonths Idade em meses (ou altura em cm se isLength = true)
 * @param isLength Se true, formata como altura em cm (para gráficos peso x altura)
 * @returns String formatada
 */
export function formatXAxisLabel(ageMonths: number, isLength?: boolean): string {
  // Se for altura/comprimento (eixo X não é tempo)
  if (isLength) {
    return `${Math.round(ageMonths)} cm`;
  }

  // Se for idade (eixo X é tempo)
  if (ageMonths === 0) {
    return 'Nasc.';
  }

  // 0-24 meses: mostrar em meses
  if (ageMonths <= 24) {
    return `${Math.floor(ageMonths)}m`;
  }

  // 24-60 meses: mostrar anos e meses
  if (ageMonths <= 60) {
    const years = Math.floor(ageMonths / 12);
    const months = Math.floor(ageMonths % 12);
    if (months === 0) {
      return `${years}a`;
    }
    return `${years}a ${months}m`;
  }

  // > 60 meses: mostrar apenas anos
  const years = Math.floor(ageMonths / 12);
  return `${years}a`;
}

/**
 * Determina a fonte de dados (WHO ou CDC) baseado na idade do paciente
 * Regra: WHO para 0-24 meses, CDC para > 24 meses
 * @param ageMonths Idade em meses
 * @returns 'WHO' ou 'CDC'
 */
export function determineSource(ageMonths: number): 'WHO' | 'CDC' {
  return ageMonths <= 24 ? 'WHO' : 'CDC';
}

/**
 * Exporta um elemento HTML (gráfico) como PNG
 * Usa html2canvas se disponível, caso contrário retorna erro
 * @param elementRef Referência do elemento DOM ou elemento HTML
 * @param filename Nome do arquivo (sem extensão)
 * @returns Promise que resolve quando o download é iniciado
 */
export async function exportChartToPNG(
  elementRef: React.RefObject<HTMLElement> | HTMLElement | null,
  filename: string = 'curva-crescimento'
): Promise<void> {
  // Verificar se html2canvas está disponível
  if (typeof window === 'undefined') {
    throw new Error('Export PNG só está disponível no navegador');
  }

  // Tentar importar html2canvas dinamicamente
  let html2canvas: any;
  try {
    html2canvas = (await import('html2canvas')).default;
  } catch (error) {
    // Se html2canvas não estiver instalado, tentar método alternativo
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
      scale: 2, // Maior resolução
      logging: false,
    });

    // Converter canvas para blob e fazer download
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
  } catch (error) {
    console.error('Erro ao exportar gráfico:', error);
    throw error;
  }
}

/**
 * Valida se os valores de entrada são razoáveis
 * @param weightKg Peso em kg
 * @param heightCm Altura em cm
 * @param headCircumferenceCm Perímetro cefálico em cm
 * @returns Objeto com erros de validação ou null se válido
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
