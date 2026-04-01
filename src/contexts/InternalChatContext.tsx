'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type {
  InternalConversation,
  InternalMessage,
  InternalChatUser,
} from '@/types/internal-chat';

interface InternalChatContextType {
  // State
  conversations: InternalConversation[];
  activeConversationId: string | null;
  activePartnerId: string | null;
  activeMessages: InternalMessage[];
  users: InternalChatUser[];
  onlineUserIds: Set<string>;
  totalUnread: number;
  isOpen: boolean;
  loading: boolean;
  loadingUsers: boolean;
  sendingFile: boolean;

  // Actions
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  openConversation: (conversationId: string) => void;
  startConversationWith: (userId: string) => Promise<string | null>;
  sendMessage: (content: string, type?: string, file?: File) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  goBackToList: () => void;
  refreshConversations: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  isUserOnline: (userId: string) => boolean;
}

const InternalChatContext = createContext<InternalChatContextType | undefined>(undefined);

// Notification sound using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.2);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.4);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // silently fail if audio context not available
  }
}

export function InternalChatProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [supabase] = useState(() => createClient());

  const [conversations, setConversations] = useState<InternalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<InternalMessage[]>([]);
  const [users, setUsers] = useState<InternalChatUser[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [totalUnread, setTotalUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const isOpenRef = useRef(false);
  const hasLoadedUsersRef = useRef(false);

  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUserIds.has(userId);
  }, [onlineUserIds]);

  // ── Presence tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || profile?.status !== 'approved') return;

    const channel = supabase.channel('internal-presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            full_name: profile?.full_name || '',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile?.status, profile?.full_name, supabase]);

  // ── Fetch all team users ───────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    // Only show loading spinner on first load
    if (!hasLoadedUsersRef.current) setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, photo_url')
      .eq('status', 'approved')
      .neq('id', user.id);
    if (data) setUsers(data as InternalChatUser[]);
    hasLoadedUsersRef.current = true;
    setLoadingUsers(false);
  }, [user, supabase]);

  // ── Fetch conversations ────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: participantData } = await supabase
      .from('internal_conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    if (!participantData || participantData.length === 0) {
      setConversations([]);
      setTotalUnread(0);
      return;
    }

    const convIds = participantData.map((p) => p.conversation_id);
    const readMap = new Map(participantData.map((p) => [p.conversation_id, p.last_read_at]));

    const { data: convData } = await supabase
      .from('internal_conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convData) return;

    // Fetch participants (without profile join — no direct FK to profiles)
    const { data: rawParticipants } = await supabase
      .from('internal_conversation_participants')
      .select('*')
      .in('conversation_id', convIds);

    // Fetch profiles for all participant user_ids
    const participantUserIds = [...new Set((rawParticipants || []).map((p) => p.user_id))];
    const { data: profilesData } = participantUserIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email, role, photo_url').in('id', participantUserIds)
      : { data: [] };

    const profileMap = new Map((profilesData || []).map((p) => [p.id, p]));

    // Merge profiles into participants
    const allParticipants = (rawParticipants || []).map((p) => ({
      ...p,
      profile: profileMap.get(p.user_id) || null,
    }));

    const conversationsWithDetails: InternalConversation[] = await Promise.all(
      convData.map(async (conv) => {
        const { data: lastMsg } = await supabase
          .from('internal_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastRead = readMap.get(conv.id) || conv.created_at;
        const { count } = await supabase
          .from('internal_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastRead);

        return {
          ...conv,
          participants: allParticipants?.filter((p) => p.conversation_id === conv.id) || [],
          last_message: lastMsg || undefined,
          unread_count: count || 0,
        };
      })
    );

    setConversations(conversationsWithDetails);
    setTotalUnread(conversationsWithDetails.reduce((sum, c) => sum + (c.unread_count || 0), 0));
  }, [user, supabase]);

  // ── Fetch messages for active conversation ─────────────────────────
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('internal_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Chat Interno] Erro ao buscar mensagens:', error.message);
      return;
    }
    if (!data || data.length === 0) {
      setActiveMessages([]);
      return;
    }

    // Fetch sender profiles separately (no FK from sender_id to profiles)
    const senderIds = [...new Set(data.map((m) => m.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', senderIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const messagesWithProfiles = data.map((m) => ({
      ...m,
      sender_profile: profileMap.get(m.sender_id) || null,
    }));

    setActiveMessages(messagesWithProfiles as InternalMessage[]);
  }, [supabase]);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setLoading(true);
    await fetchMessages(conversationId);
    setLoading(false);
  }, [fetchMessages]);

  const goBackToList = useCallback(() => {
    setActiveConversationId(null);
    setActivePartnerId(null);
    setActiveMessages([]);
  }, []);

  // ── Start or get existing conversation ─────────────────────────────
  const startConversationWith = useCallback(async (targetUserId: string): Promise<string | null> => {
    if (!user) return null;

    // Check for existing conversation between the two users
    const { data: myConvs, error: myConvsErr } = await supabase
      .from('internal_conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myConvsErr) {
      console.error('[Chat Interno] Erro ao buscar conversas:', myConvsErr.message);
    }

    if (myConvs && myConvs.length > 0) {
      const myConvIds = myConvs.map((c) => c.conversation_id);
      const { data: theirConvs } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvIds);

      if (theirConvs && theirConvs.length > 0) {
        const existingConvId = theirConvs[0].conversation_id;
        setActivePartnerId(targetUserId);
        await openConversation(existingConvId);
        return existingConvId;
      }
    }

    // Create new conversation (generate UUID client-side to avoid SELECT after INSERT,
    // which would fail RLS since no participants exist yet)
    const newConvId = crypto.randomUUID();
    const { error: convError } = await supabase
      .from('internal_conversations')
      .insert({ id: newConvId });

    if (convError) {
      console.error('[Chat Interno] Erro ao criar conversa:', convError.message);
      return null;
    }

    // Add both participants
    const { error: partError } = await supabase.from('internal_conversation_participants').insert([
      { conversation_id: newConvId, user_id: user.id },
      { conversation_id: newConvId, user_id: targetUserId },
    ]);

    if (partError) {
      console.error('[Chat Interno] Erro ao adicionar participantes:', partError.message);
      return null;
    }

    setActivePartnerId(targetUserId);
    await fetchConversations();
    await openConversation(newConvId);
    return newConvId;
  }, [user, supabase, openConversation, fetchConversations]);

  // ── Send a message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (content: string, type: string = 'text', file?: File) => {
    if (!user || !activeConversationId) return;

    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    if (file) {
      setSendingFile(true);
      const ext = file.name.split('.').pop();
      const path = `${activeConversationId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('internal-chat-files')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        setSendingFile(false);
        console.error('Upload error:', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('internal-chat-files')
        .getPublicUrl(uploadData.path);

      fileUrl = urlData.publicUrl;
      fileName = file.name;
      fileSize = file.size;
      setSendingFile(false);
    }

    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: msgError } = await supabase
      .from('internal_messages')
      .insert({
        id: msgId,
        conversation_id: activeConversationId,
        sender_id: user.id,
        content: content || fileName || '',
        message_type: type,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
      });

    if (msgError) {
      console.error('[Chat Interno] Erro ao enviar mensagem:', msgError.message);
      return;
    }

    // Add message to local state immediately (no need for SELECT + RLS)
    const optimisticMsg: InternalMessage = {
      id: msgId,
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: content || fileName || '',
      message_type: type as InternalMessage['message_type'],
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize ? Number(fileSize) : null,
      created_at: now,
      sender_profile: { full_name: profile?.full_name || null, role: profile?.role || 'secretary' },
    };
    setActiveMessages((prev) => [...prev, optimisticMsg]);

    await supabase
      .from('internal_conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', activeConversationId)
      .eq('user_id', user.id);

    await fetchConversations();
  }, [user, profile?.full_name, profile?.role, activeConversationId, supabase, fetchConversations]);

  // ── Mark conversation as read ──────────────────────────────────────
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    await supabase
      .from('internal_conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    await fetchConversations();
  }, [user, supabase, fetchConversations]);

  // ── Delete conversation ─────────────────────────────────────────────
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    // Delete the conversation (CASCADE will remove participants and messages)
    await supabase
      .from('internal_conversations')
      .delete()
      .eq('id', conversationId);

    // If we're viewing this conversation, go back to list
    if (activeConvIdRef.current === conversationId) {
      setActiveConversationId(null);
      setActivePartnerId(null);
      setActiveMessages([]);
    }

    await fetchConversations();
  }, [user, supabase, fetchConversations]);

  // ── Initial data fetch ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || profile?.status !== 'approved') return;
    let cancelled = false;

    async function init() {
      await Promise.allSettled([fetchUsers(), fetchConversations()]);
      if (cancelled) return;
    }

    void init();
    return () => { cancelled = true; };
  }, [user, profile?.status, fetchUsers, fetchConversations]);

  // ── Realtime subscription for new messages ─────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('internal-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages',
        },
        async (payload) => {
          const newMsg = payload.new as InternalMessage;

          if (newMsg.sender_id === user.id) return;

          playNotificationSound();

          if (activeConvIdRef.current === newMsg.conversation_id) {
            // Fetch the message + sender profile separately
            const { data: msgData } = await supabase
              .from('internal_messages')
              .select('*')
              .eq('id', newMsg.id)
              .single();

            if (msgData) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', msgData.sender_id)
                .single();

              const enriched = { ...msgData, sender_profile: senderProfile || null };
              setActiveMessages((prev) => {
                if (prev.some((m) => m.id === enriched.id)) return prev;
                return [...prev, enriched as InternalMessage];
              });
            }

            if (isOpenRef.current) {
              await supabase
                .from('internal_conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', newMsg.conversation_id)
                .eq('user_id', user.id);
            }
          }

          await fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchConversations]);

  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  const refreshUsers = useCallback(async () => {
    await fetchUsers();
  }, [fetchUsers]);

  const value = useMemo(() => ({
    conversations,
    activeConversationId,
    activePartnerId,
    activeMessages,
    users,
    onlineUserIds,
    totalUnread,
    isOpen,
    loading,
    loadingUsers,
    sendingFile,
    setIsOpen,
    toggleOpen,
    openConversation,
    startConversationWith,
    sendMessage,
    markAsRead,
    deleteConversation,
    goBackToList,
    refreshConversations,
    refreshUsers,
    isUserOnline,
  }), [
    conversations, activeConversationId, activePartnerId, activeMessages, users, onlineUserIds,
    totalUnread, isOpen, loading, loadingUsers, sendingFile, openConversation,
    startConversationWith, sendMessage, markAsRead, deleteConversation, goBackToList,
    refreshConversations, refreshUsers, toggleOpen, isUserOnline,
  ]);

  return (
    <InternalChatContext.Provider value={value}>
      {children}
    </InternalChatContext.Provider>
  );
}

export function useInternalChat() {
  const ctx = useContext(InternalChatContext);
  if (!ctx) throw new Error('useInternalChat must be used within InternalChatProvider');
  return ctx;
}
