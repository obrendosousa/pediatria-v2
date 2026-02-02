/**
 * Utilitários para manipulação de datas e timezones no sistema de agendamentos
 * 
 * Estratégia: Tratar todos os horários como hora local do cliente/servidor
 * PostgreSQL armazena como timestamp with time zone, mas sempre trabalhamos
 * com a perspectiva de hora local para melhor UX
 */

/**
 * Converte uma data no formato YYYY-MM-DD para o range de início e fim do dia
 * no timezone local, retornando em formato ISO para queries no Supabase
 * 
 * @param dateString Data no formato YYYY-MM-DD
 * @returns Objeto com startOfDay e endOfDay em ISO string para queries
 */
export function getLocalDateRange(dateString: string): { startOfDay: string; endOfDay: string } {
  // Parse da data no formato YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Criar data no timezone local (00:00:00 do dia)
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Criar data no timezone local (23:59:59.999 do dia)
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
  
  // Converter para ISO string para queries no Supabase
  // O PostgreSQL vai interpretar como UTC, mas como estamos usando o mesmo
  // offset em todas as queries, funciona corretamente
  return {
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString()
  };
}

/**
 * Formata o horário de um appointment considerando timezone local
 * 
 * @param dateString String de data/hora do banco (ISO ou formato local)
 * @returns Horário formatado no formato HH:MM
 */
export function formatAppointmentTime(dateString: string | null | undefined): string {
  if (!dateString) return '00:00';
  
  try {
    // Limpar timezone info se presente
    const cleanDateStr = dateString.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
    const [datePart, timePart] = cleanDateStr.split('T');
    
    if (datePart && timePart) {
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      
      // Criar data local (sem conversão de timezone)
      const d = new Date(year, month - 1, day, hours, minutes || 0, 0);
      return d.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      });
    }
  } catch (e) {
    console.error('Erro ao formatar horário:', e);
  }
  
  return '00:00';
}

/**
 * Converte data e hora locais para formato de salvamento no banco
 * O formato será interpretado pelo PostgreSQL como hora local do servidor
 * 
 * @param date Data no formato YYYY-MM-DD
 * @param time Hora no formato HH:MM
 * @returns String no formato YYYY-MM-DDTHH:MM:SS para salvar no banco
 */
export function saveAppointmentDateTime(date: string, time: string): string {
  // Garantir formato correto
  const datePart = date.trim();
  const timePart = time.trim().padEnd(5, '0').substring(0, 5); // Garantir HH:MM
  
  // Retornar no formato ISO sem timezone (será interpretado como local pelo PostgreSQL)
  return `${datePart}T${timePart}:00`;
}

/**
 * Extrai a data local de um timestamp do banco
 * 
 * @param dateString String de data/hora do banco
 * @returns Data no formato YYYY-MM-DD no timezone local
 */
export function parseAppointmentDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  
  try {
    // Limpar timezone info se presente e extrair apenas a parte da data
    const cleanDateStr = dateString.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
    const [datePart, timePart] = cleanDateStr.split('T');
    
    if (datePart) {
      // Se já está no formato YYYY-MM-DD, usar diretamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        // Se temos timePart, criar Date local para garantir que estamos no dia correto
        // mesmo se o timestamp veio com timezone diferente
        if (timePart) {
          const [year, month, day] = datePart.split('-').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          // Criar data local (sem conversão de timezone)
          const localDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0);
          const yearStr = localDate.getFullYear();
          const monthStr = String(localDate.getMonth() + 1).padStart(2, '0');
          const dayStr = String(localDate.getDate()).padStart(2, '0');
          return `${yearStr}-${monthStr}-${dayStr}`;
        }
        return datePart;
      }
      
      // Tentar parsear como Date e extrair data local
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  } catch (e) {
    console.error('Erro ao parsear data:', e);
  }
  
  return null;
}

/**
 * Verifica se um appointment pertence a uma data específica (no timezone local)
 * 
 * @param appointmentStartTime start_time do appointment
 * @param targetDate Data alvo no formato YYYY-MM-DD
 * @returns true se o appointment pertence à data alvo
 */
export function isAppointmentOnDate(appointmentStartTime: string | null | undefined, targetDate: string): boolean {
  if (!appointmentStartTime) return false;
  
  const appointmentDate = parseAppointmentDate(appointmentStartTime);
  return appointmentDate === targetDate;
}

/**
 * Obtém a data atual no formato YYYY-MM-DD (timezone local)
 * 
 * @returns Data atual no formato YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Adiciona ou subtrai dias de uma data no formato YYYY-MM-DD
 * mantendo o timezone local
 * 
 * @param dateString Data no formato YYYY-MM-DD
 * @param days Número de dias a adicionar (positivo) ou subtrair (negativo)
 * @returns Nova data no formato YYYY-MM-DD
 */
export function addDaysToDate(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  return `${newYear}-${newMonth}-${newDay}`;
}
