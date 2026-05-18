import { supabase } from './supabase';
import type { AurenChatMode } from './aurenChatApi';

export type StoredChat = {
  id: string;
  title: string;
  mode: AurenChatMode;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};

type ChatRow = {
  id: string;
  title: string | null;
  mode: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};

function normalizeChat(row: ChatRow): StoredChat {
  return {
    id: row.id,
    title: row.title?.trim() || 'New chat',
    mode: 'study',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createChatTitle(message: string) {
  const cleanMessage = message.replace(/\s+/g, ' ').trim();

  if (!cleanMessage) return 'New chat';

  if (cleanMessage.length <= 42) return cleanMessage;

  return `${cleanMessage.slice(0, 42).trim()}…`;
}

export function formatChatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export async function listUserChats(userId: string) {
  const { data, error } = await supabase
    .from('chats')
    .select('id, title, mode, created_at, updated_at')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return ((data ?? []) as ChatRow[]).map(normalizeChat);
}

export async function createUserChat(userId: string, title: string, mode: AurenChatMode) {
  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title,
      mode,
    })
    .select('id, title, mode, created_at, updated_at')
    .single();

  if (error) throw error;

  return normalizeChat(data as ChatRow);
}

export async function loadChatMessages(userId: string, chatId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as MessageRow[];
}

export async function saveChatMessage(input: {
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: input.chatId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
    })
    .select('id, role, content, created_at')
    .single();

  if (error) throw error;

  return data as StoredMessage;
}

export async function touchChat(input: {
  chatId: string;
  userId: string;
  title?: string;
}) {
  const update: { updated_at: string; title?: string } = {
    updated_at: new Date().toISOString(),
  };

  if (input.title) {
    update.title = input.title;
  }

  const { error } = await supabase
    .from('chats')
    .update(update)
    .eq('id', input.chatId)
    .eq('user_id', input.userId);

  if (error) throw error;
}
