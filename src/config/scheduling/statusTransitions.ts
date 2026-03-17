/**
 * Máquina de estados para transições de status de agendamentos.
 * Define quais transições são válidas a partir de cada status.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled:       ['confirmed', 'waiting', 'cancelled', 'no_show', 'rescheduled', 'unmarked'],
  confirmed:       ['waiting', 'cancelled', 'no_show', 'rescheduled', 'unmarked', 'late'],
  waiting:         ['called', 'in_service', 'cancelled', 'no_show', 'late'],
  called:          ['in_service', 'waiting', 'no_show'],
  late:            ['waiting', 'in_service', 'cancelled', 'no_show'],
  in_service:      ['waiting_payment', 'finished'],
  waiting_payment: ['finished'],
  finished:        [],
  cancelled:       [],
  no_show:         ['rescheduled'],
  unmarked:        ['scheduled', 'rescheduled'],
  not_attended:    ['rescheduled'],
  rescheduled:     ['scheduled'],
  blocked:         [],
};

export const STATUS_LABELS: Record<string, string> = {
  scheduled:       'Agendado',
  confirmed:       'Confirmado',
  waiting:         'Sala de Espera',
  called:          'Chamado',
  in_service:      'Em Atendimento',
  waiting_payment: 'Aguardando Pagamento',
  finished:        'Atendido',
  late:            'Atrasado',
  no_show:         'Faltou',
  cancelled:       'Cancelado',
  unmarked:        'Desmarcado',
  not_attended:    'Nao Atendido',
  rescheduled:     'Reagendado',
  blocked:         'Bloqueio',
};

/** Retorna a lista de status para os quais é válido transicionar a partir do status atual */
export function getValidNextStatuses(currentStatus: string): string[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/** Verifica se uma transição de status específica é válida */
export function isValidTransition(from: string, to: string): boolean {
  return getValidNextStatuses(from).includes(to);
}
