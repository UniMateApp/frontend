import { supabase as getSupabase } from './supabase';

export type Conversation = {
  id: string;
  participant1: string | null;
  participant2: string | null;
  created_at?: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  is_read: boolean;
};

// Prefix to encode a location payload inside the text content column
export const LOCATION_PREFIX = '__loc__:';

const buildParticipantOr = (a: string, b: string) =>
  `and(participant1.eq.${a},participant2.eq.${b}),and(participant1.eq.${b},participant2.eq.${a})`;

export async function findOrCreateConversation(currentUserId: string, otherUserId: string): Promise<Conversation> {
  if (!currentUserId || !otherUserId) {
    throw new Error('Both current user and other user are required to start a conversation');
  }
  const client = await getSupabase();

  const { data: existing, error: findError } = await client
    .from('conversations')
    .select('*')
    .or(buildParticipantOr(currentUserId, otherUserId))
    .maybeSingle();

  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  if (existing) return existing as Conversation;

  const { data, error } = await client
    .from('conversations')
    .insert({ participant1: currentUserId, participant2: otherUserId })
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const client = await getSupabase();
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await client
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content: trimmed });
  if (error) throw error;
}

export async function sendLocationMessage(
  conversationId: string,
  senderId: string,
  coords: { latitude: number; longitude: number },
) {
  const payload = `${LOCATION_PREFIX}${coords.latitude},${coords.longitude}`;
  return sendMessage(conversationId, senderId, payload);
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const client = await getSupabase();
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return (data as Message[]) || [];
}

export async function markMessagesRead(conversationId: string, currentUserId: string) {
  const client = await getSupabase();
  const { error } = await client
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', currentUserId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function getUnreadCounts(currentUserId: string) {
  const client = await getSupabase();
  const { data: conversations, error: convoError } = await client
    .from('conversations')
    .select('id')
    .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`);

  if (convoError) throw convoError;
  const ids = (conversations || []).map((c: any) => c.id);
  if (!ids.length) return [] as { conversation_id: string; count: number }[];

  // Fetch all unread messages and count them per conversation in JavaScript
  const { data, error } = await client
    .from('messages')
    .select('conversation_id')
    .eq('is_read', false)
    .neq('sender_id', currentUserId)
    .in('conversation_id', ids);

  if (error) throw error;
  
  // Group by conversation_id in JavaScript
  const counts = (data || []).reduce((acc: any, msg: any) => {
    const convId = msg.conversation_id;
    acc[convId] = (acc[convId] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(counts).map(([conversation_id, count]) => ({ 
    conversation_id, 
    count: count as number 
  }));
}

export async function getTotalUnreadCount(currentUserId: string): Promise<number> {
  const client = await getSupabase();
  const { data: conversations, error: convoError } = await client
    .from('conversations')
    .select('id')
    .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`);

  if (convoError) throw convoError;
  const ids = (conversations || []).map((c: any) => c.id);
  if (!ids.length) return 0;

  // Count all unread messages for this user
  const { data, error } = await client
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .neq('sender_id', currentUserId)
    .in('conversation_id', ids);

  if (error) throw error;
  return (data as any) || 0;
}

export async function getUserConversations(currentUserId: string) {
  const client = await getSupabase();
  const { data, error } = await client
    .from('conversations')
    .select('*')
    .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data as Conversation[]) || [];
}

export async function getLastMessageForConversation(conversationId: string): Promise<Message | null> {
  const client = await getSupabase();
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) throw error;
  return data as Message | null;
}

export function subscribeToMessages(
  conversationId: string,
  onInsert: (msg: Message) => void,
  onUpdate?: (msg: Message) => void,
) {
  const channelPromise = (async () => {
    const client = await getSupabase();
    const channel = client
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          onInsert(payload.new as Message);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          onUpdate?.(payload.new as Message);
        },
      )
      .subscribe();
    
    return channel;
  })();

  return async () => {
    const channel = await channelPromise;
    const client = await getSupabase();
    await client.removeChannel(channel);
  };
}

// Subscribe to any new messages the current user can read (RLS-restricted).
export function subscribeToIncomingMessages(
  currentUserId: string,
  onInsert: (msg: Message) => void,
) {
  const channelPromise = (async () => {
    const client = await getSupabase();
    const channel = client
      .channel(`messages:incoming:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=neq.${currentUserId}` },
        payload => {
          onInsert(payload.new as Message);
        },
      )
      .subscribe();
    
    return channel;
  })();

  return async () => {
    const channel = await channelPromise;
    const client = await getSupabase();
    await client.removeChannel(channel);
  };
}
