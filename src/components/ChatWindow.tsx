import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Download, PanelLeft, Sun, Moon, Sparkles } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MessageBubble, TypingIndicator } from './MessageBubble';
import { Composer } from './Composer';
import { exportConversationMarkdown } from '../lib/export';
import { getToneConfig, TONES } from '../lib/tones';
import type { ChatMessage, Conversation, ThreadGroup, Tone } from '../lib/types';

interface ChatWindowProps {
  conversations: Conversation[];
  groups: ThreadGroup[];
  activeId: string | null;
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  streaming: boolean;
  streamingText: string;
  streamError: string | null;
  tone: Tone;
  sidebarOpen: boolean;
  searching: boolean;
  query: string;
  theme: 'dark' | 'light';
  onQueryChange: (q: string) => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onToneChange: (tone: Tone) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onRegenerate: () => void;
  onEditResend: (messageId: string, newContent: string) => void;
}

const STARTERS = [
  { title: 'Explain a hard idea simply', prompt: 'Explain how large language models work, in simple terms.' },
  { title: 'Draft a friendly email', prompt: 'Help me write a friendly email to a teammate asking for a status update.' },
  { title: 'Plan something fun', prompt: 'Plan a relaxed weekend in Lisbon with great food and minimal walking.' },
  { title: 'Make me a study plan', prompt: 'Create a one-week study plan to learn the basics of SQL.' },
];

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-white/10 dark:bg-zinc-100 dark:text-zinc-900"
      >
        <Sparkles size={20} />
      </div>
      <h1 className="text-[26px] font-semibold tracking-tight sm:text-3xl">How can I help today?</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        Ask anything, or start from one of the suggestions below. Switch the vibe above the input
        to change how the assistant responds.
      </p>
      <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.title}
            onClick={() => onPick(s.prompt)}
            className="rounded-xl border border-zinc-200 bg-white/70 p-3.5 text-left text-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
          >
            <span className="block font-medium">{s.title}</span>
            <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{s.prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatWindow(props: ChatWindowProps) {
  const {
    messages, streaming, streamingText, streamError, tone, activeConversation,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const toneCfg = getToneConfig(tone);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streamingText]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
    setShowJump(distance > 160);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const sendFromEmpty = (prompt: string) => props.onSend(prompt);

  return (
    <div className="flex h-screen min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-200/70 px-3 py-2.5 dark:border-white/5">
        <button
          onClick={props.onToggleSidebar}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-white/5 md:hidden"
          aria-label="Open sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {activeConversation?.title ?? 'New chat'}
        </h2>
        {activeConversation && messages.length > 0 && (
          <button
            onClick={() => activeConversation && exportConversationMarkdown(activeConversation, messages)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <Download size={14} /> Export
          </button>
        )}
        <button
          onClick={props.onToggleTheme}
          className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-200/60 dark:hover:bg-white/5"
          aria-label="Toggle light or dark mode"
        >
          {props.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {messages.length === 0 && !streaming ? (
          <EmptyState onPick={sendFromEmpty} />
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scrollbar-thin h-full overflow-y-auto scroll-smooth"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
              {messages.map((m) =>
                editingId === m.id ? (
                  <div key={m.id} className="flex flex-col items-end gap-2">
                    <textarea
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
            className="w-full max-w-[85%] rounded-xl border border-zinc-300 bg-white p-3 text-[15px] outline-none focus:border-zinc-400 dark:border-white/15 dark:bg-[#1e1e26] dark:focus:border-white/25 sm:max-w-[70%]"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          props.onEditResend(m.id, editDraft.trim());
                        }}
                        disabled={!editDraft.trim()}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium dark:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isStreaming={false}
                    isLastAssistant={m.id === lastAssistantId}
                    canEdit
                    onStartEdit={() => {
                      setEditingId(m.id);
                      setEditDraft(m.content);
                    }}
                    onRegenerate={props.onRegenerate}
                    onRetry={props.onRetry}
                  />
                )
              )}

              {streaming && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] sm:max-w-[75%]">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        aria-hidden
                      >
                        <Sparkles size={11} />
                      </span>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Vibe Chat
                      </span>
                      <span
                        className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${toneCfg.ui.accentSoft}`}
                      >
                        {toneCfg.badge}
                      </span>
                    </div>
                    <div className="pl-7">
                      {streamingText ? (
                        <div className={`md-body stream-caret ${toneCfg.ui.caret}`}>
                          <p className="whitespace-pre-wrap break-words">{streamingText}</p>
                        </div>
                      ) : (
                        <TypingIndicator dotClass={toneCfg.ui.dot} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {streamError && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-[15px] sm:max-w-[75%]">
                    <p>{streamError}</p>
                    <button
                      onClick={props.onRetry}
                      className="mt-2 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showJump && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-lg transition hover:bg-zinc-50 dark:border-white/10 dark:bg-[#232329] dark:text-zinc-200 dark:hover:bg-[#2a2a32]"
          >
            <ArrowDown size={13} /> Jump to latest
          </button>
        )}
      </div>

      <div className="border-t border-zinc-200/70 px-4 pb-4 pt-3 dark:border-white/5">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            tone={tone}
            onToneChange={props.onToneChange}
            onSend={props.onSend}
            onStop={props.onStop}
            streaming={streaming}
          />
          <p className="mt-2 hidden text-center text-[11px] text-zinc-400 sm:block">
            Vibe Chat can make mistakes. {TONES[tone].badge} vibe is on — it applies to your next message instantly.
          </p>
        </div>
      </div>
    </div>
  );
}

