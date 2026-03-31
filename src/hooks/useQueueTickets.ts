'use client';

import { useState, useCallback } from 'react';
import { createSchemaClient } from '@/lib/supabase/schemaClient';
import { createClient } from '@/lib/supabase/client';
import type { QueueTicket, QueueTicketWithDetails, QueueStage } from '@/types/queue';

const supabase = createSchemaClient('atendimento');
const supabasePublic = createClient();

/** Retorna o client correto para atualizar o appointment no schema de origem */
const getAptClient = (sourceSchema?: 'public' | 'atendimento') =>
  sourceSchema === 'public' ? supabasePublic : supabase;

export function useQueueTickets() {
  const [tickets, setTickets] = useState<QueueTicketWithDetails[]>([]);
  const [loading, setLoading] = useState(false);

  /** Busca todos os tickets do dia com dados de appointment e service_point */
  const fetchTodayTickets = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('queue_tickets')
        .select(`
          *,
          appointment:appointment_id(
            id, doctor_id, date, time, patient_id,
            patients:patient_id(full_name, phone)
          ),
          service_point:service_point_id(id, name, code, type)
        `)
        .eq('ticket_date', today)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useQueueTickets] fetchTodayTickets error:', error);
        return [];
      }
      setTickets((data || []) as QueueTicketWithDetails[]);
      return (data || []) as QueueTicketWithDetails[];
    } catch (err) {
      console.error('[useQueueTickets] fetchTodayTickets catch:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /** Gera uma nova senha para o agendamento
   * @param sourceSchema - 'public' para pediatria, 'atendimento' para clinica geral
   */
  const generateTicket = useCallback(async (
    appointmentId: number,
    isPriority: boolean,
    stage: QueueStage,
    sourceSchema?: 'public' | 'atendimento'
  ): Promise<QueueTicket> => {
    // Determinar prefixo: P para prioridade, G para guichê, C para consultório
    const prefix = isPriority ? 'P' : (stage === 'reception' ? 'G' : 'C');
    const ticketType = isPriority ? 'priority' : (stage === 'reception' ? 'guiche' : 'consultorio');

    // Gerar próximo número via RPC
    const { data: ticketNumber, error: rpcError } = await supabase
      .rpc('next_ticket_number', { p_prefix: prefix });
    if (rpcError) throw new Error(rpcError.message || 'Erro ao gerar numero da senha');

    // Inserir ticket (sempre no schema atendimento.queue_tickets)
    const { data: ticket, error: insertError } = await supabase
      .from('queue_tickets')
      .insert({
        appointment_id: appointmentId,
        ticket_number: ticketNumber as string,
        ticket_type: ticketType,
        queue_stage: stage,
        is_priority: isPriority,
        status: 'waiting',
        source_schema: sourceSchema || 'atendimento',
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message || 'Erro ao inserir senha');

    // Atualizar appointment com stage e ticket_id (no schema correto)
    const aptClient = getAptClient(sourceSchema);
    await aptClient
      .from('appointments')
      .update({
        queue_stage: stage,
        current_ticket_id: (ticket as QueueTicket).id,
        status: 'waiting',
      })
      .eq('id', appointmentId);

    return ticket as QueueTicket;
  }, []);

  /** Chama um ticket para um ponto de atendimento e dispara TTS */
  const callTicket = useCallback(async (
    ticketId: number,
    servicePointId: number,
    patientName: string,
    servicePointName: string,
    servicePointCode: string,
    doctorName?: string,
    isPriority?: boolean
  ) => {
    // Atualizar status do ticket
    const { data: ticket, error } = await supabase
      .from('queue_tickets')
      .update({
        status: 'called',
        service_point_id: servicePointId,
        called_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();
    if (error) throw new Error(error.message || 'Erro na operacao de fila');

    const tk = ticket as QueueTicket;

    // Atualizar appointment status para 'called' (detectar schema via source_schema do ticket)
    const ticketSourceSchema = (tk as QueueTicket & { source_schema?: string }).source_schema;
    const aptClient = getAptClient(ticketSourceSchema as 'public' | 'atendimento' | undefined);
    await aptClient
      .from('appointments')
      .update({ status: 'called' })
      .eq('id', tk.appointment_id);

    // Disparar API TTS + broadcast para TV (fire-and-forget)
    fetch('/api/atendimento/queue/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: tk.id,
        ticketNumber: tk.ticket_number,
        patientName,
        servicePointName,
        servicePointCode,
        doctorName,
        isPriority: isPriority ?? tk.is_priority,
      }),
    }).catch(console.error);

    return tk;
  }, []);

  /** Marca ticket como em atendimento */
  const startService = useCallback(async (ticketId: number) => {
    const { error } = await supabase
      .from('queue_tickets')
      .update({ status: 'in_service', served_at: new Date().toISOString() })
      .eq('id', ticketId);
    if (error) throw new Error(error.message || 'Erro na operacao de fila');
  }, []);

  /** Marca ticket como completo */
  const completeTicket = useCallback(async (ticketId: number) => {
    const { error } = await supabase
      .from('queue_tickets')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', ticketId);
    if (error) throw new Error(error.message || 'Erro na operacao de fila');
  }, []);

  /** Retorna o ticket ativo (waiting ou called) de um appointment */
  const getActiveTicket = useCallback(async (appointmentId: number): Promise<QueueTicket | null> => {
    const { data } = await supabase
      .from('queue_tickets')
      .select('*')
      .eq('appointment_id', appointmentId)
      .in('status', ['waiting', 'called', 'in_service'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as QueueTicket) || null;
  }, []);

  return {
    tickets,
    loading,
    fetchTodayTickets,
    generateTicket,
    callTicket,
    startService,
    completeTicket,
    getActiveTicket,
  };
}
