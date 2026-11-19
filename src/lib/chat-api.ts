import { CHAT_FUNCTION_URL, supabase } from './supabase';
import type { Conversation, Tone } from './types';

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Conversation[];
}

export async function searchConversations(query: string): Promise<Conversation[]> {
  const q = query.trim();
  if (!q) return listConversations();

  // Match on title (ilike) OR on any message content (fts via text search).
  const { data: byTitle, error: titleError } = await supabase
    .from('conversations')
    .select('*')
    .ilike('title', `%${q}%`)
    .order('updated_at', { ascending: false });
  if (titleError) throw new Error(titleError.message);

  const { data: matches, error: msgError } = await supabase
    .from('messages')
    .select('conversation_id, content')
    .textSearch('content', q, { type: 'websearch' });
  if (msgError) throw new Error(msgError.message);

  const ids = new Set((matches ?? []).map((m: { conversation_id: string }) => m.conversation_id));
  const existing = new Set((byTitle ?? []).map((c: Conversation) => c.id));
  const extraIds = [...ids].filter((id) => !existing.has(id));

  let extra: Conversation[] = [];
  if (extraIds.length > 0) {
    const { data: extraData, error: extraError } = await supabase
      .from('conversations')
      .select('*')
      .in('id', extraIds);
    if (extraError) throw new Error(extraError.message);
    extra = (extraData ?? []) as Conversation[];
  }

  const seen = new Set<string>();
  return [...(byTitle ?? []), ...extra]
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function createConversation(tone: Tone): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ title: 'New chat', tone })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Conversation;
}

export async function updateConversation(
  id: string,
  patch: Partial<Pick<Conversation, 'title' | 'tone' | 'pinned'>>
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function searchMessageSnippets(
  conversationId: string,
  query: string
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const { data, error } = await supabase
    .from('messages')
    .select('content')
    .eq('conversation_id', conversationId)
    .ilike('content', `%${q}%`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const content = (data as { content: string }).content;
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return content.slice(0, 90);
  const start = Math.max(0, idx - 25);
  return (
    (start > 0 ? '…' : '') + content.slice(start, idx + q.length + 45).replace(/\s+/g, ' ') + '…'
  );
}
