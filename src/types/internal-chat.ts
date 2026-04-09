// Types for the internal chat system (Doctor <-> Secretary communication)

export interface InternalConversation {
  id: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  participants?: InternalParticipant[];
  last_message?: InternalMessage;
  unread_count?: number;
}

export interface InternalParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  created_at: string;
  // Joined from profiles
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
    photo_url?: string | null;
  };
}

export type InternalMessageType = 'text' | 'image' | 'document' | 'audio' | 'video';

export interface InternalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: InternalMessageType;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  created_at: string;
  // Joined
  sender_profile?: {
    full_name: string | null;
    role: string;
  };
}

export interface InternalChatUser {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  photo_url?: string | null;
  is_online?: boolean;
  last_seen?: string | null;
}
