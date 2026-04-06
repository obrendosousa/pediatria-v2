// Clara v2 Neural Network - Agent Message Bus
// Inter-agent communication via Supabase (persistent)
// Based on Claude Code's send_message.rs DashMap inbox pattern

import { getSupabaseAdminClient } from '@/lib/automation/adapters/supabaseAdmin';
import type { AgentMessage, MessageType } from './types';

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

export async function sendMessage(
  fromAgent: string,
  toAgent: string,
  content: Record<string, unknown>,
  messageType: MessageType,
  taskId?: string
): Promise<AgentMessage> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('clara_agent_messages')
    .insert({
      from_agent: fromAgent,
      to_agent: toAgent,
      content,
      message_type: messageType,
      task_id: taskId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to send message: ${error.message}`);
  return data as AgentMessage;
}

export async function broadcastMessage(
  fromAgent: string,
  content: Record<string, unknown>,
  messageType: MessageType,
  taskId?: string
): Promise<void> {
  // Broadcast = send to '*', all agents check for their ID or '*'
  await sendMessage(fromAgent, '*', content, messageType, taskId);
}

// ---------------------------------------------------------------------------
// Read (mirrors drain_inbox / peek_inbox from send_message.rs)
// ---------------------------------------------------------------------------

export async function readMessages(
  agentId: string,
  options?: { markAsRead?: boolean; limit?: number }
): Promise<AgentMessage[]> {
  const supabase = getSupabaseAdminClient();
  const markAsRead = options?.markAsRead ?? true;
  const limit = options?.limit ?? 50;

  // Fetch messages addressed to this agent or broadcast ('*'), unread only
  const { data, error } = await supabase
    .from('clara_agent_messages')
    .select()
    .or(`to_agent.eq.${agentId},to_agent.eq.*`)
    .is('read_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to read messages: ${error.message}`);

  const messages = (data ?? []) as AgentMessage[];

  // Mark as read (drain_inbox pattern)
  if (markAsRead && messages.length > 0) {
    const ids = messages.map(m => m.id);
    await supabase
      .from('clara_agent_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
  }

  return messages;
}

export async function peekMessages(
  agentId: string,
  limit: number = 50
): Promise<AgentMessage[]> {
  return readMessages(agentId, { markAsRead: false, limit });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export async function getUnreadCount(agentId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();

  const { count, error } = await supabase
    .from('clara_agent_messages')
    .select('*', { count: 'exact', head: true })
    .or(`to_agent.eq.${agentId},to_agent.eq.*`)
    .is('read_at', null);

  if (error) throw new Error(`Failed to count messages: ${error.message}`);
  return count ?? 0;
}

export async function getMessagesForTask(taskId: string): Promise<AgentMessage[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('clara_agent_messages')
    .select()
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get task messages: ${error.message}`);
  return (data ?? []) as AgentMessage[];
}
