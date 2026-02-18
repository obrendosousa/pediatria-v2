// src/utils/automationVariables.ts
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { differenceInMonths, differenceInDays, parseISO, isValid } from 'date-fns';
import { Patient } from '@/types/patient';
import { Appointment } from '@/types/medical';

export interface VariableData {
  patient?: Patient;
  appointment?: Appointment;
  checkout?: any; // MedicalCheckout
}

/**
 * Lista de variáveis disponíveis para uso nas automações
 */
export const AVAILABLE_VARIABLES = [
  { key: 'nome_paciente', label: 'Nome do Paciente', description: 'Nome completo do paciente' },
  { key: 'nome_responsavel', label: 'Nome do Responsável', description: 'Nome do responsável (primeiro da lista de familiares)' },
  { key: 'idade', label: 'Idade', description: 'Idade formatada (ex: "3 meses")' },
  { key: 'idade_meses', label: 'Idade em Meses', description: 'Idade em meses (número)' },
  { key: 'data_consulta', label: 'Data da Consulta', description: 'Data da consulta (DD/MM/YYYY)' },
  { key: 'hora_consulta', label: 'Hora da Consulta', description: 'Hora da consulta (HH:MM)' },
  { key: 'nome_medico', label: 'Nome do Médico', description: 'Nome do médico responsável' },
  { key: 'telefone', label: 'Telefone', description: 'Telefone do paciente' },
  { key: 'endereco', label: 'Endereço Completo', description: 'Endereço completo formatado' },
  { key: 'cidade', label: 'Cidade', description: 'Cidade do paciente' },
  { key: 'data_nascimento', label: 'Data de Nascimento', description: 'Data de nascimento (DD/MM/YYYY)' },
  { key: 'data_retorno', label: 'Data de Retorno', description: 'Data do retorno agendado (DD/MM/YYYY)' },
  { key: 'observacoes_retorno', label: 'Observações do Retorno', description: 'Observações do retorno agendado' },
];

/**
 * Calcula idade em meses a partir da data de nascimento
 */
function calculateAgeInMonths(birthDate: string | Date | undefined | null): number {
  if (!birthDate) return 0;
  
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(birth)) return 0;
  
  const today = new Date();
  return differenceInMonths(today, birth);
}

/**
 * Formata idade de forma legível (ex: "3 meses", "1 ano e 2 meses")
 */
function formatAge(birthDate: string | Date | undefined | null): string {
  if (!birthDate) return 'idade não informada';
  
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  if (!isValid(birth)) return 'data inválida';
  
  const today = new Date();
  const months = differenceInMonths(today, birth);
  const days = differenceInDays(today, birth) % 30;
  
  if (months === 0) {
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  
  if (months < 12) {
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }
  
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`;
}

/**
 * Formata endereço completo
 */
function formatAddress(patient: Patient | undefined): string {
  if (!patient) return '';
  
  const parts: string[] = [];
  
  if (patient.address_street) {
    let street = patient.address_street;
    if (patient.address_number) street += `, ${patient.address_number}`;
    if (patient.address_complement) street += ` - ${patient.address_complement}`;
    parts.push(street);
  }
  
  if (patient.address_neighborhood) {
    parts.push(patient.address_neighborhood);
  }
  
  if (patient.address_city) {
    let city = patient.address_city;
    if (patient.address_state) city += ` - ${patient.address_state}`;
    parts.push(city);
  }
  
  if (patient.address_zip) {
    parts.push(`CEP: ${patient.address_zip}`);
  }
  
  return parts.join(', ') || 'Endereço não informado';
}

/**
 * Obtém nome do responsável (primeiro familiar da lista)
 */
function getResponsibleName(patient: Patient | undefined): string {
  if (!patient) return '';
  
  // Verifica se há family_members (pode ser array ou objeto)
  const familyMembers = (patient as any).family_members;
  if (Array.isArray(familyMembers) && familyMembers.length > 0) {
    return familyMembers[0].name || '';
  }
  
  // Fallback para campos legados
  if ((patient as any).mother_name) {
    return (patient as any).mother_name;
  }
  
  if ((patient as any).father_name) {
    return (patient as any).father_name;
  }
  
  return 'Responsável não informado';
}

/**
 * Substitui variáveis no template de mensagem
 */
export function replaceVariables(
  template: string,
  data: VariableData
): string {
  if (!template) return '';
  
  let result = template;
  const { patient, appointment, checkout } = data;
  
  // Nome do paciente
  result = result.replace(/\{nome_paciente\}/g, patient?.name || 'Paciente');
  
  // Nome do responsável
  result = result.replace(/\{nome_responsavel\}/g, getResponsibleName(patient));
  
  // Idade formatada
  result = result.replace(/\{idade\}/g, formatAge(patient?.birth_date));
  
  // Idade em meses (número)
  const ageMonths = calculateAgeInMonths(patient?.birth_date);
  result = result.replace(/\{idade_meses\}/g, ageMonths.toString());
  
  // Data de nascimento
  if (patient?.birth_date) {
    try {
      const birthDate = parseISO(patient.birth_date);
      if (isValid(birthDate)) {
        result = result.replace(/\{data_nascimento\}/g, format(birthDate, 'dd/MM/yyyy', { locale: ptBR }));
      }
    } catch {
      // Ignora erro de parsing
    }
  }
  result = result.replace(/\{data_nascimento\}/g, 'Data não informada');
  
  // Telefone
  result = result.replace(/\{telefone\}/g, patient?.phone || 'Telefone não informado');
  
  // Endereço completo
  result = result.replace(/\{endereco\}/g, formatAddress(patient));
  
  // Cidade
  result = result.replace(/\{cidade\}/g, patient?.address_city || 'Cidade não informada');
  
  // Dados da consulta
  if (appointment) {
    try {
      const appointmentDate = parseISO(appointment.start_time);
      if (isValid(appointmentDate)) {
        result = result.replace(/\{data_consulta\}/g, format(appointmentDate, 'dd/MM/yyyy', { locale: ptBR }));
        result = result.replace(/\{hora_consulta\}/g, format(appointmentDate, 'HH:mm', { locale: ptBR }));
      }
    } catch {
      // Ignora erro de parsing
    }
    result = result.replace(/\{nome_medico\}/g, appointment.doctor_name || 'Médico não informado');
  } else {
    result = result.replace(/\{data_consulta\}/g, 'Data não informada');
    result = result.replace(/\{hora_consulta\}/g, 'Hora não informada');
    result = result.replace(/\{nome_medico\}/g, 'Médico não informado');
  }
  
  // Dados do retorno
  if (checkout?.return_date) {
    try {
      const returnDate = parseISO(checkout.return_date);
      if (isValid(returnDate)) {
        result = result.replace(/\{data_retorno\}/g, format(returnDate, 'dd/MM/yyyy', { locale: ptBR }));
      }
    } catch {
      // Ignora erro de parsing
    }
    result = result.replace(/\{observacoes_retorno\}/g, checkout.return_obs || 'Sem observações');
  } else {
    result = result.replace(/\{data_retorno\}/g, 'Data não informada');
    result = result.replace(/\{observacoes_retorno\}/g, 'Sem observações');
  }
  
  return result;
}

/**
 * Extrai todas as variáveis usadas em um template
 */
export function extractVariables(template: string): string[] {
  if (!template) return [];
  
  const regex = /\{([^}]+)\}/g;
  const matches = template.matchAll(regex);
  const variables = Array.from(matches, match => match[1]);
  
  return [...new Set(variables)]; // Remove duplicatas
}

/**
 * Valida se todas as variáveis usadas são válidas
 */
export function validateVariables(template: string): { valid: boolean; invalid: string[] } {
  const used = extractVariables(template);
  const validKeys = AVAILABLE_VARIABLES.map(v => v.key);
  const invalid = used.filter(v => !validKeys.includes(v));
  
  return {
    valid: invalid.length === 0,
    invalid
  };
}
