import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

/**
 * Busca paciente por telefone no banco de dados
 * @param phone - Telefone do paciente (pode estar formatado)
 * @returns ID do paciente se encontrado, null caso contrário
 */
export async function findPatientByPhone(phone: string): Promise<number | null> {
  if (!phone) return null;
  
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from('patients')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();
    
    if (error) {
      console.error('Erro ao buscar paciente:', error);
      return null;
    }
    
    return data?.id || null;
  } catch (error) {
    console.error('Erro ao buscar paciente por telefone:', error);
    return null;
  }
}

/**
 * Busca ou cria paciente baseado no telefone
 * Se não encontrar, retorna null (indica que precisa cadastro)
 * @param phone - Telefone do paciente
 * @returns ID do paciente ou null se não encontrado
 */
export async function findOrCreatePatientByPhone(phone: string): Promise<number | null> {
  const patientId = await findPatientByPhone(phone);
  
  if (patientId) {
    return patientId;
  }
  
  // Retorna null para indicar que precisa cadastro
  // O cadastro será feito no modal antes de abrir o prontuário
  return null;
}
