import { createClient } from '@/lib/supabase/client';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'cancel'
  | 'login'
  | 'approve_user'
  | 'reject_user';
export type AuditEntity =
  | 'patient'
  | 'appointment'
  | 'chat'
  | 'sale'
  | 'config'
  | 'profile'
  | 'checkout'
  | 'user_approval'
  | 'product'
  | 'product_batch'
  | 'cash_closure'
  | 'stock_movement'
  | 'financial_transaction';

export interface AuditParams {
  userId: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Registra uma ação no audit_log. Usar após mutações bem-sucedidas.
 * No cliente: obter userId do useAuth().user?.id.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  const { userId, action, entityType, entityId = null, details = null, ipAddress = null } = params;
  const supabase = createClient();
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ? (typeof details === 'object' ? details : { value: details }) : null,
    ip_address: ipAddress,
  });
}
