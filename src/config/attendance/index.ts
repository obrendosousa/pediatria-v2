// Barrel export das configs de attendance por módulo
export { PEDIATRIA_ATTENDANCE } from './pediatria';
export { GERAL_ATTENDANCE } from './geral';

import type { AttendanceModuleConfig } from '@/types/attendance';
import { PEDIATRIA_ATTENDANCE } from './pediatria';
import { GERAL_ATTENDANCE } from './geral';

// Mapa módulo → config de attendance
export const ATTENDANCE_CONFIGS: Record<string, AttendanceModuleConfig> = {
  pediatria: PEDIATRIA_ATTENDANCE,
  atendimento: GERAL_ATTENDANCE,
};
