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
  activeMessages: InternalMessage[];
  users: InternalChatUser[];
  totalUnread: number;
  isOpen: boolean;
  loading: boolean;
  loadingUsers: boolean;
  sendingFile: boolean;

  // Actions
  setIsOpen: (open: boolean) => void;
  openConversation: (conversationId: string) => void;
  startConversationWith: (userId: string) => Promise<string | null>;
  sendMessage: (content: string, type?: string, file?: File) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  goBackToList: () => void;
  refreshConversations: () => Promise<void>;
  refreshUsers: () => Promise<void>;
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
  const [activeMessages, setActiveMessages] = useState<InternalMessage[]>([]);
  const [users, setUsers] = useState<InternalChatUser[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);

  const activeConvIdRef = useRef<string | null>(null);
  const isOpenRef = useRef(false);

  useEffect(() => { activeConvIdRef.current = activeConversationId; }, [activeConversationId]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Fetch all team users (for starting new conversations)
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoadingUsers(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('status', 'approved')
      .neq('id', user.id);
    if (data) setUsers(data as InternalChatUser[]);
    setLoadingUsers(false);
  }, [user, supabase]);

  // Fetch conversations with last message and unread count
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get conversations where current user is participant
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

    // Get conversations
    const { data: convData } = await supabase
      .from('internal_conversations')
      .select('*')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!convData) return;

    // Get all participants for these conversations with their profiles
    const { data: allParticipants } = await supabase
      .from('internal_conversation_participants')
      .select('*, profile:profiles(id, full_name, email, role)')
      .in('conversation_id', convIds);

    // Get last message for each conversation
    const conversationsWithDetails: InternalConversation[] = await Promise.all(
      convData.map(async (conv) => {
        const { data: lastMsg } = await supabase
          .from('internal_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count unread messages
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

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('internal_messages')
      .select('*, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, role)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) setActiveMessages(data as InternalMessage[]);
  }, [supabase]);

  // Open a conversation
  const openConversation = useCallback(async (conversationId: string) => {
    setActiveConversationId(conversationId);
    setLoading(true);
    await fetchMessages(conversationId);
    setLoading(false);
  }, [fetchMessages]);

  // Go back to conversation list
  const goBackToList = useCallback(() => {
    setActiveConversationId(null);
    setActiveMessages([]);
  }, []);

  // Start or get existing conversation with a user
  const startConversationWith = useCallback(async (targetUserId: string): Promise<string | null> => {
    if (!user) return null;

    // Check if a 1:1 conversation already exists between these two users
    const { data: myConvs } = await supabase
      .from('internal_conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (myConvs && myConvs.length > 0) {
      const myConvIds = myConvs.map((c) => c.conversation_id);
      const { data: theirConvs } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvIds);

      if (theirConvs && theirConvs.length > 0) {
        // Conversation exists, open it
        const existingConvId = theirConvs[0].conversation_id;
        openConversation(existingConvId);
        return existingConvId;
      }
    }

    // Create new conversation
    const { data: newConv, error: convError } = await supabase
      .from('internal_conversations')
      .insert({})
      .select()
      .single();

    if (convError || !newConv) return null;

    // Add both participants
    await supabase.from('internal_conversation_participants').insert([
      { conversation_id: newConv.id, user_id: user.id },
      { conversation_id: newConv.id, user_id: targetUserId },
    ]);

    await fetchConversations();
    openConversation(newConv.id);
    return newConv.id;
  }, [user, supabase, openConversation, fetchConversations]);

  // Send a message
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

    const { data: newMsg } = await supabase
      .from('internal_messages')
      .insert({
        conversation_id: activeConversationId,
        sender_id: user.id,
        content: content || fileName || '',
        message_type: type,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
      })
      .select('*, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, role)')
      .single();

    if (newMsg) {
      setActiveMessages((prev) => [...prev, newMsg as InternalMessage]);
    }

    // Update last_read_at for sender
    await supabase
      .from('internal_conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', activeConversationId)
      .eq('user_id', user.id);

    await fetchConversations();
  }, [user, activeConversationId, supabase, fetchConversations]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;
    await supabase
      .from('internal_conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
    await fetchConversations();
  }, [user, supabase, fetchConversations]);

  // Initial data fetch — use void to avoid set-state-in-effect lint rule
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

  // Realtime subscription for new messages
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

          // Skip own messages
          if (newMsg.sender_id === user.id) return;

          // Play notification sound
          playNotificationSound();

          // If this message is in the active conversation, add it
          if (activeConvIdRef.current === newMsg.conversation_id) {
            // Fetch with joined profile
            const { data } = await supabase
              .from('internal_messages')
              .select('*, sender_profile:profiles!internal_messages_sender_id_fkey(full_name, role)')
              .eq('id', newMsg.id)
              .single();

            if (data) {
              setActiveMessages((prev) => {
                if (prev.some((m) => m.id === data.id)) return prev;
                return [...prev, data as InternalMessage];
              });
            }

            // Auto mark as read if chat is open
            if (isOpenRef.current) {
              await supabase
                .from('internal_conversation_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', newMsg.conversation_id)
                .eq('user_id', user.id);
            }
          }

          // Refresh conversation list
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
    activeMessages,
    users,
    totalUnread,
    isOpen,
    loading,
    loadingUsers,
    sendingFile,
    setIsOpen,
    openConversation,
    startConversationWith,
    sendMessage,
    markAsRead,
    goBackToList,
    refreshConversations,
    refreshUsers,
  }), [
    conversations, activeConversationId, activeMessages, users, totalUnread,
    isOpen, loading, loadingUsers, sendingFile, openConversation, startConversationWith,
    sendMessage, markAsRead, goBackToList, refreshConversations, refreshUsers,
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
