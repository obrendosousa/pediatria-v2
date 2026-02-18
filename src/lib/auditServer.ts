import type { SupabaseClient } from '@supabase/supabase-js';

export type ServerAuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'cancel'
  | 'login'
  | 'approve_user'
  | 'reject_user';

export type ServerAuditEntity =
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

type ServerAuditParams = {
  supabase: SupabaseClient;
  userId: string;
  action: ServerAuditAction;
  entityType: ServerAuditEntity;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

export async function logAuditServer(params: ServerAuditParams): Promise<void> {
  const {
    supabase,
    userId,
    action,
    entityType,
    entityId = null,
    details = null,
    ipAddress = null
  } = params;

  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    ip_address: ipAddress
  });
}
