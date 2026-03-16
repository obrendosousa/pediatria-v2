/**
 * Replaces template variables like {PACIENTE}, {CPF}, etc.
 * with actual patient data.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} anos`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAddress(patient: any): string {
  const parts = [
    patient.street,
    patient.number && `nº ${patient.number}`,
    patient.complement,
    patient.neighborhood,
    patient.city,
    patient.state,
    patient.zip_code,
  ].filter(Boolean);
  return parts.join(', ') || '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceTemplateVariables(html: string, patientData: any): string {
  if (!html || !patientData) return html;

  const vars: Record<string, string> = {
    PACIENTE: patientData.full_name || patientData.name || '',
    CPF: patientData.cpf || '',
    RG: patientData.rg || '',
    NASCIMENTO: patientData.birth_date ? formatDate(patientData.birth_date) : '',
    IDADE: patientData.birth_date ? calculateAge(patientData.birth_date) : '',
    'ENDEREÇO_PACIENTE': buildAddress(patientData),
    DATA: new Date().toLocaleDateString('pt-BR'),
  };

  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    // Replace both {KEY} and { KEY } (with possible spaces)
    result = result.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), value);
  }

  return result;
}
