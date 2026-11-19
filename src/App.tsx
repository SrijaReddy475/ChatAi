import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { Sidebar } from './components/Sidebar';
import { startChatStream } from './hooks/useChatStream';
import { useTheme } from './hooks/useTheme';
import {
  createConversation,
  deleteConversation,
  listConversations,
  searchConversations,
  searchMessageSnippets,
  updateConversation,
} from './lib/chat-api';
import { supabase } from './lib/supabase';
import type { ChatMessage, Conversation, Tone } from './lib/types';
import { groupConversations, useDebounced } from './lib/ui-utils';

export default function App() {
  const { theme, toggleTheme } = useTheme();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [tone, setTone] = useState<Tone>('professional');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 300);
  const [searching, setSearching] = useState(false);
  const [searchSnippets, setSearchSnippets] = useState<Record<string, string>>({});

  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const rafBufferRef = useRef('');
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  // ---- Initial load -------------------------------------------------------
  useEffect(() => {
    listConversations()
      .then((threads) => {
        setConversations(threads);
        if (threads.length > 0) setActiveId(threads[0].id);
      })
      .catch(() => setStreamError('Could not load your chats. Is the database reachable?'))
      .finally(() => setLoadingThreads(false));
  }, []);

  // ---- Load messages for the active thread --------------------------------
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setStreamError(null);
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingMessages(false);
        if (error) {
          setStreamError('Could not load this conversation.');
          return;
        }
        setMessages((data ?? []) as ChatMessage[]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // ---- Sidebar search -----------------------------------------------------
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSearching(false);
      listConversations()
        .then(setConversations)
        .catch(() => undefined);
      setSearchSnippets({});
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchConversations(q)
      .then(async (results) => {
        if (cancelled) return;
        setConversations(results);
        const snippets: Record<string, string> = {};
        for (const c of results.slice(0, 12)) {
          const snippet = await searchMessageSnippets(c.id, q);
          if (snippet) snippets[c.id] = snippet;
        }
        if (!cancelled) setSearchSnippets(snippets);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ---- Streaming helpers --------------------------------------------------
  const flushBuffer = useCallback(() => {
    if (!rafBufferRef.current) return;
    const chunk = rafBufferRef.current;
    rafBufferRef.current = '';
    setStreamingText((prev) => prev + chunk);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      flushBuffer();
    });
  }, [flushBuffer]);

  const refreshThreads = useCallback(async () => {
    if (debouncedQuery.trim()) {
      const results = await searchConversations(debouncedQuery);
      setConversations(results);
    } else {
      setConversations(await listConversations());
    }
  }, [debouncedQuery]);

  const persistPartial = useCallback(
    async (conversationId: string, text: string) => {
      if (!text.trim()) return;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: text,
        tone,
        interrupted: true,
      });
    },
    [tone]
  );

  const persistAssistant = useCallback(
    async (conversationId: string, content: string, usedTone: Tone) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content,
          tone: usedTone,
        })
        .select()
        .maybeSingle();
      if (error || !data) return;
      setMessages((prev) => [...prev, data as ChatMessage]);
      setStreamingText('');
    },
    []
  );

  const runStream = useCallback(
    async (conversationId: string, userMessage: string, currentTone: Tone) => {
      setStreaming(true);
      setStreamError(null);
      setStreamingText('');
      rafBufferRef.current = '';

      const controller = new AbortController();
      abortRef.current = controller;

      let finished = false;
      const finish = async (text: string) => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
        flushBuffer();
        setStreaming(false);
        abortRef.current = null;
        if (text.trim()) {
          const finalText = text;
          await persistAssistant(conversationId, finalText, currentTone);
        }
        refreshThreads().catch(() => undefined);
      };

      await startChatStream({
        conversationId,
        message: userMessage,
        tone: currentTone,
        signal: controller.signal,
        handlers: {
          onTitle: (title) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
            );
          },
          onToken: (token) => {
            rafBufferRef.current += token;
            scheduleFlush();
          },
          onDone: (full) => void finish(full),
          onError: (message) => {
            finished = true;
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = 0;
            setStreaming(false);
            abortRef.current = null;
            setStreamError(message);
            refreshThreads().catch(() => undefined);
          },
        },
      });
    },
    [flushBuffer, scheduleFlush, refreshThreads, persistAssistant]
  );

  // ---- Actions ------------------------------------------------------------
  const handleSend = useCallback(
    async (text: string) => {
      let conversationId = activeIdRef.current;
      let optimistic: ChatMessage | null = null;

      if (!conversationId) {
        const created = await createConversation(tone);
        conversationId = created.id;
        activeIdRef.current = created.id;
        setActiveId(created.id);
        setConversations((prev) => [created, ...prev]);
      } else {
        optimistic = {
          id: `pending-${Date.now()}`,
          role: 'user',
          content: text,
          tone,
          created_at: new Date().toISOString(),
          pending: true,
        };
        setMessages((prev) => [...prev, optimistic as ChatMessage]);
      }

      const { data: saved, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, role: 'user', content: text, tone })
        .select()
        .maybeSingle();
      if (error) {
        setStreamError('Could not save your message. Please try again.');
        return;
      }

      if (optimistic) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic!.id ? (saved as ChatMessage) : m)));
      } else if (saved) {
        setMessages((prev) => [...prev, saved as ChatMessage]);
      }

      await runStream(conversationId, text, tone);
    },
    [tone, runStream]
  );

  const handleStop = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    abortRef.current = null;
    const id = activeIdRef.current;
    const partial = streamingText + rafBufferRef.current;
    controller.abort();
    setStreaming(false);
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = 0;
    flushBuffer();
    if (id && partial.trim()) {
      void persistPartial(id, partial).then(() => {
        setMessages((prev) => [
          ...prev.filter((m) => !m.pending),
          {
            id: `interrupted-${Date.now()}`,
            conversation_id: id,
            role: 'assistant',
            content: partial,
            tone,
            interrupted: true,
            created_at: new Date().toISOString(),
          },
        ]);
        setStreamingText('');
      });
    } else {
      setStreamingText('');
    }
  }, [streamingText, tone, flushBuffer, persistPartial]);

  const handleRetry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || !activeIdRef.current) return;
    setStreamError(null);
    setMessages((prev) => {
      const idx = prev.findLastIndex((m) => m.role === 'user');
      return idx === -1 ? prev : prev.slice(0, idx);
    });
    void runStream(activeIdRef.current, lastUser.content, tone);
  }, [messages, tone, runStream]);

  const handleRegenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || !activeIdRef.current) return;

    // Remove trailing assistant messages server-side, then re-run.
    const conversationId = activeIdRef.current;
    void (async () => {
      const { data: assistantMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false });
      const lastAssistant = (assistantMessages ?? [])[0] as { id: string } | undefined;
      if (lastAssistant) {
        await supabase.from('messages').delete().eq('id', lastAssistant.id);
      }
      setMessages((prev) => {
        const idx = prev.findLastIndex((m) => m.role === 'assistant');
        return idx === -1 ? prev : prev.slice(0, idx);
      });
      await runStream(conversationId, lastUser.content, tone);
    })();
  }, [messages, tone, runStream]);

  const handleEditResend = useCallback(
    (messageId: string, newContent: string) => {
      if (!newContent || !activeIdRef.current) return;
      const conversationId = activeIdRef.current;
      void (async () => {
        const idx = messages.findIndex((m) => m.id === messageId);
        const removed = idx === -1 ? [] : messages.slice(idx);
        const removableIds = removed.filter((m) => !m.pending).map((m) => m.id);
        if (removableIds.length > 0) {
          await supabase.from('messages').delete().in('id', removableIds);
        }
        setMessages((prev) => prev.slice(0, idx));
        const { data: saved } = await supabase
          .from('messages')
          .insert({ conversation_id: conversationId, role: 'user', content: newContent, tone })
          .select()
          .maybeSingle();
        if (saved) setMessages((prev) => [...prev, saved as ChatMessage]);
        await runStream(conversationId, newContent, tone);
      })();
    },
    [messages, tone, runStream]
  );

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
    activeIdRef.current = null;
    setMessages([]);
    setStreamingText('');
    setStreamError(null);
    setSidebarOpen(false);
  }, []);

  const handleRename = useCallback((id: string, title: string) => {
    updateConversation(id, { title }).catch(() => undefined);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  const handleTogglePin = useCallback((id: string, pinned: boolean) => {
    updateConversation(id, { pinned }).catch(() => undefined);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteConversation(id).catch(() => undefined);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeIdRef.current === id) {
        activeIdRef.current = null;
        setActiveId(null);
        setMessages([]);
      }
    },
    []
  );

  const handleToneChange = useCallback((next: Tone) => {
    setTone(next);
    const id = activeIdRef.current;
    if (id) {
      updateConversation(id, { tone }).catch(() => undefined);
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, tone: next } : c)));
    }
  }, []);

  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#131316] dark:text-zinc-100">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        groups={groups}
        activeId={activeId}
        query={query}
        onQueryChange={setQuery}
        searching={searching || loadingThreads}
        onNewChat={handleNewChat}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onRename={handleRename}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
      />
      <ChatWindow
        conversations={conversations}
        groups={groups}
        activeId={activeId}
        activeConversation={activeConversation}
        messages={messages}
        streaming={streaming}
        streamingText={streamingText}
        streamError={streamError}
        tone={tone}
        sidebarOpen={sidebarOpen}
        searching={searching || loadingMessages}
        query={query}
        theme={theme}
        onQueryChange={setQuery}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleTheme={toggleTheme}
        onNewChat={handleNewChat}
        onSelect={setActiveId}
        onRename={handleRename}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
        onToneChange={handleToneChange}
        onSend={handleSend}
        onStop={handleStop}
        onRetry={handleRetry}
        onRegenerate={handleRegenerate}
        onEditResend={handleEditResend}
      />
    </div>
  );
}
