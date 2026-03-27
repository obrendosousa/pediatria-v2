// Constantes e tipos para sistema unificado de responsáveis/familiares

export const GUARDIAN_RELATIONSHIPS = [
  { value: 'Mãe', label: 'Mãe' },
  { value: 'Pai', label: 'Pai' },
  { value: 'Avó', label: 'Avó' },
  { value: 'Avô', label: 'Avô' },
  { value: 'Tia', label: 'Tia' },
  { value: 'Tio', label: 'Tio' },
  { value: 'Irmã', label: 'Irmã' },
  { value: 'Irmão', label: 'Irmão' },
  { value: 'Cônjuge', label: 'Cônjuge' },
  { value: 'Filho(a)', label: 'Filho(a)' },
  { value: 'Responsável Legal', label: 'Responsável Legal' },
  { value: 'Outro', label: 'Outro' },
] as const;

export type GuardianRelationship = typeof GUARDIAN_RELATIONSHIPS[number]['value'];

export interface FamilyMember {
  name: string;
  relationship: string;
  phone?: string;
  cpf?: string;
  is_legal_guardian?: boolean;
}

/**
 * Extrai mother_name/father_name de um array de family_members para backward compat
 * com colunas flat no banco de dados.
 */
export function syncFlatColumnsFromFamilyMembers(members: FamilyMember[]): {
  mother_name: string | null;
  father_name: string | null;
  parent_name: string | null;
  responsible_name: string | null;
  responsible_cpf: string | null;
} {
  const mother = members.find(m => m.relationship === 'Mãe');
  const father = members.find(m => m.relationship === 'Pai');
  const guardian = members.find(m => m.is_legal_guardian);
  const firstMember = members[0];

  return {
    mother_name: mother?.name?.trim() || null,
    father_name: father?.name?.trim() || null,
    parent_name: guardian?.name?.trim() || mother?.name?.trim() || father?.name?.trim() || firstMember?.name?.trim() || null,
    responsible_name: guardian?.name?.trim() || null,
    responsible_cpf: guardian?.cpf?.trim() || null,
  };
}

/**
 * Converte campos flat legados (mother_name, father_name, etc.) para o formato family_members.
 * Usado para migrar dados antigos ao abrir formulários de edição.
 */
export function flatFieldsToFamilyMembers(opts: {
  mother_name?: string | null;
  father_name?: string | null;
  responsible_name?: string | null;
  responsible_cpf?: string | null;
  parent_name?: string | null;
}): FamilyMember[] {
  const members: FamilyMember[] = [];

  if (opts.mother_name?.trim()) {
    members.push({ name: opts.mother_name.trim(), relationship: 'Mãe' });
  }
  if (opts.father_name?.trim()) {
    members.push({ name: opts.father_name.trim(), relationship: 'Pai' });
  }
  if (opts.responsible_name?.trim()) {
    // Evitar duplicata se responsável já é mãe ou pai
    const alreadyExists = members.some(m => m.name === opts.responsible_name?.trim());
    if (!alreadyExists) {
      members.push({
        name: opts.responsible_name.trim(),
        relationship: 'Responsável Legal',
        cpf: opts.responsible_cpf?.trim() || undefined,
        is_legal_guardian: true,
      });
    }
  }

  return members;
}
