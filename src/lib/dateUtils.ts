import { differenceInYears, differenceInMonths, differenceInDays, subYears, subMonths, isValid, parseISO } from 'date-fns';

/**
 * Calcula a idade exata para uso médico (Padrão: "1 ano, 9 meses e 15 dias")
 * Essencial para dosagem de medicamentos pediátricos.
 */
export function calculatePreciseAge(birthDateInput: string | Date | undefined | null): string {
  if (!birthDateInput) return 'Idade não informada';

  // Garante que é um objeto Date
  let birthDate: Date;
  if (typeof birthDateInput === 'string') {
    // Tenta parseISO primeiro (formato ISO: YYYY-MM-DD)
    birthDate = parseISO(birthDateInput);
    // Se não for válido, tenta parse direto (formato brasileiro: DD/MM/YYYY)
    if (!isValid(birthDate) && birthDateInput.includes('/')) {
      const [day, month, year] = birthDateInput.split('/').map(Number);
      if (day && month && year) {
        birthDate = new Date(year, month - 1, day);
      }
    }
  } else {
    birthDate = birthDateInput;
  }

  const today = new Date();

  if (!isValid(birthDate)) {
    console.warn('Data de nascimento inválida:', birthDateInput);
    return 'Data inválida';
  }

  // Verifica se a data de nascimento não é no futuro
  if (birthDate > today) {
    console.warn('Data de nascimento no futuro:', birthDateInput);
    return 'Data inválida';
  }

  // Lógica de "Steps" para precisão cirúrgica
  // 1. Calcula anos totais
  const years = differenceInYears(today, birthDate);
  // 2. Subtrai os anos da data de hoje para calcular os meses restantes
  const dateMinusYears = subYears(today, years);

  // 3. Calcula meses restantes
  const months = differenceInMonths(dateMinusYears, birthDate);
  // 4. Subtrai os meses para calcular os dias restantes
  const dateMinusMonths = subMonths(dateMinusYears, months);

  // 5. Calcula dias restantes
  const days = differenceInDays(dateMinusMonths, birthDate);

  const parts = [];

  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);

  // Se nasceu hoje (0 anos, 0 meses, 0 dias)
  if (parts.length === 0) {
    // Verifica se realmente é hoje
    const todayStr = today.toISOString().split('T')[0];
    const birthStr = birthDate.toISOString().split('T')[0];
    if (todayStr === birthStr) {
      return 'Recém-nascido (Hoje)';
    }
    // Se não for hoje mas ainda assim tem 0 de tudo, algo está errado
    return 'Idade não calculável';
  }

  // Formatação Gramatical ("1 ano, 9 meses e 15 dias")
  if (parts.length > 1) {
    const lastPart = parts.pop();
    return `${parts.join(', ')} e ${lastPart}`;
  }

  return parts[0];
}

/**
 * Formatação curta para cards e listas (Ex: "10a 2m")
 */
export function calculateShortAge(birthDateInput: string | Date | undefined | null): string {
  if (!birthDateInput) return '-';
  const birthDate = typeof birthDateInput === 'string' ? parseISO(birthDateInput) : birthDateInput;
  if (!isValid(birthDate)) return '-';
  
  const today = new Date();
  const years = differenceInYears(today, birthDate);
  const dateMinusYears = subYears(today, years);
  const months = differenceInMonths(dateMinusYears, birthDate);

  if (years === 0 && months === 0) {
      const days = differenceInDays(today, birthDate);
      return `${days}d`;
  }
  
  if (years === 0) return `${months}m`;
  return `${years}a ${months}m`;
}

// Mantém compatibilidade com seu código antigo, se houver chamadas perdidas
export function calculatePediatricAge(birthDate: string): string {
    return calculateShortAge(birthDate);
}