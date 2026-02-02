// Utilitário para parsear nome do arquivo e extrair metadados

import * as path from 'path';

export interface GrowthFileMetadata {
  type: 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh';
  gender: 'male' | 'female';
  source: 'WHO' | 'CDC';
  ageRange?: string;
  filename: string;
}

/**
 * Parseia o nome do arquivo para extrair metadados
 * Padrões esperados:
 * - wfa_boys_0_5_zscores.json → type='wfa', gender='male', age_range='0_5', source='WHO'
 * - bmifa_girls_2_5_zscores.json → type='bmifa', gender='female', age_range='2_5', source='WHO'
 * - wfa_boys_cdc.json → type='wfa', gender='male', source='CDC'
 * - lhfa_girls_zscores.json → type='lhfa', gender='female', source='WHO'
 */
export function parseGrowthFileName(filename: string): GrowthFileMetadata | null {
  const basename = path.basename(filename, '.json');
  const parts = basename.toLowerCase().split('_');

  // Detectar source (CDC ou WHO)
  const source: 'WHO' | 'CDC' = basename.includes('cdc') ? 'CDC' : 'WHO';

  // Mapear tipos de curva
  const typeMap: Record<string, 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh'> = {
    'wfa': 'wfa',
    'weightforage': 'wfa',
    'weight-for-age': 'wfa',
    'lhfa': 'lhfa',
    'lengthforage': 'lhfa',
    'heightforage': 'lhfa',
    'length-for-age': 'lhfa',
    'height-for-age': 'lhfa',
    'bmifa': 'bmifa',
    'bmiforage': 'bmifa',
    'bmi-for-age': 'bmifa',
    'hcfa': 'hcfa',
    'headcircumferenceforage': 'hcfa',
    'head-circumference-for-age': 'hcfa',
    'wfl': 'wfl',
    'weightforlength': 'wfl',
    'weight-for-length': 'wfl',
    'wfh': 'wfh',
    'weightforheight': 'wfh',
    'weight-for-height': 'wfh',
  };

  // Encontrar tipo
  let type: 'wfa' | 'lhfa' | 'bmifa' | 'hcfa' | 'wfl' | 'wfh' | null = null;
  for (const part of parts) {
    if (typeMap[part]) {
      type = typeMap[part];
      break;
    }
  }

  if (!type) {
    // Tentar detectar por padrões mais específicos
    if (basename.includes('weight') && basename.includes('age')) type = 'wfa';
    else if (basename.includes('length') || basename.includes('height')) {
      if (basename.includes('age')) type = 'lhfa';
      else if (basename.includes('weight')) type = 'wfl';
    }
    else if (basename.includes('bmi')) type = 'bmifa';
    else if (basename.includes('head') || basename.includes('circumference')) type = 'hcfa';
  }

  if (!type) {
    console.warn(`⚠️  Tipo de curva não identificado para: ${filename}`);
    return null;
  }

  // Detectar gênero
  let gender: 'male' | 'female' | null = null;
  if (parts.includes('boys') || parts.includes('boy') || parts.includes('male')) {
    gender = 'male';
  } else if (parts.includes('girls') || parts.includes('girl') || parts.includes('female')) {
    gender = 'female';
  }

  if (!gender) {
    console.warn(`⚠️  Gênero não identificado para: ${filename}`);
    return null;
  }

  // Detectar faixa etária (opcional)
  let ageRange: string | undefined;
  
  // Padrões comuns: 0_5, 2_5, 5_10, 5_19
  const agePattern = /(\d+)[_-](\d+)/;
  const ageMatch = basename.match(agePattern);
  if (ageMatch) {
    ageRange = `${ageMatch[1]}_${ageMatch[2]}`;
  }

  return {
    type,
    gender,
    source,
    ageRange,
    filename: path.basename(filename),
  };
}

/**
 * Valida se os metadados parseados são válidos
 */
export function validateMetadata(metadata: GrowthFileMetadata | null): boolean {
  if (!metadata) return false;
  
  const validTypes = ['wfa', 'lhfa', 'bmifa', 'hcfa', 'wfl', 'wfh'];
  const validGenders = ['male', 'female'];
  const validSources = ['WHO', 'CDC'];

  return (
    validTypes.includes(metadata.type) &&
    validGenders.includes(metadata.gender) &&
    validSources.includes(metadata.source)
  );
}
