import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Pencil, RefreshCcw, Sparkles, TriangleAlert } from 'lucide-react';

import type { ChatMessage, Tone } from '../lib/types';
import { getToneConfig } from '../lib/tones';
import { useCopy } from '../lib/ui-utils';

const ReactMarkdown = lazy(() => import('react-markdown'));
const remarkGfm = () => import('remark-gfm').then((m) => m.default);

export function TypingIndicator({ dotClass }: { dotClass: string }) {
  return (
    <div className="flex items-center gap-1 px-1 py-2" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-dot-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const { copied, copy } = useCopy();
  const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? 'code';
  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-zinc-200/60 bg-[#16181d] dark:border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">{lang}</span>
        <button
          onClick={() => copy(children)}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="text-zinc-100">
        <code className={`font-mono ${className ?? ''}`}>{children}</code>
      </pre>
    </div>
  );
}

export interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  isLastAssistant: boolean;
  canEdit: boolean;
  onStartEdit: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
}

export function MessageBubble({
  message,
  isStreaming,
  isLastAssistant,
  canEdit,
  onStartEdit,
  onRegenerate,
  onRetry,
}: MessageBubbleProps) {
  const tone = getToneConfig(message.tone);
  const { copied, copy } = useCopy();
  const [showActions, setShowActions] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [plainText, setPlainText] = useState('');

  useEffect(() => {
    if (message.role === 'assistant') setPlainText(contentRef.current?.innerText ?? '');
  }, [message.role, message.content, isStreaming]);

  if (message.role === 'user') {
    return (
      <div className="group animate-fade-slide-in flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1 sm:max-w-[70%]">
          <div className="rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-50 shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="flex items-center gap-2 pr-1 opacity-0 transition group-hover:opacity-100">
            <time className="text-[11px] text-zinc-500 dark:text-zinc-500">
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            {canEdit && !isStreaming && (
              <button
                onClick={onStartEdit}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100"
              >
                <Pencil size={11} /> Edit &amp; resend
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isError = message.content.startsWith('⚠️');

  return (
    <div
      className="group animate-fade-slide-in flex justify-start"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex max-w-[88%] flex-col items-start gap-1.5 sm:max-w-[75%]">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            aria-hidden
          >
            <Sparkles size={11} />
          </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Vibe Chat</span>
          <span
            className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${tone.ui.accentSoft}`}
          >
            {tone.badge}
          </span>
        </div>
        <div
          className="pl-7"
          aria-live={isStreaming ? 'polite' : undefined}
        >
          {isError ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 text-[15px]">
                <TriangleAlert size={18} className="mt-0.5 shrink-0 text-red-500" />
                <span>{message.content.replace('⚠️ ', '')}</span>
              </div>
              <button
                onClick={onRetry}
                className="flex w-fit items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
              >
                <RefreshCcw size={13} /> Retry
              </button>
            </div>
          ) : (
            <div
              ref={contentRef}
              className={`md-body ${isStreaming ? 'stream-caret' : ''}`}
            >
              <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
                <MarkdownWithErrorBoundary content={message.content} />
              </Suspense>
            </div>
          )}
        </div>
        <div
          className={`flex items-center gap-2 pl-1 transition ${
            showActions || isStreaming ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <time className="text-[11px] text-zinc-500 dark:text-zinc-500">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
          {!isStreaming && !isError && (
            <button
              onClick={() => copy(plainText)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy message'}
            </button>
          )}
          {isLastAssistant && !isStreaming && !isError && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-zinc-500 transition hover:bg-zinc-200/70 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-100"
            >
              <RefreshCcw size={11} /> Regenerate
              <span className="sr-only">the previous response</span>
            </button>
          )}
          {message.interrupted && !isStreaming && (
            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-400">
              Interrupted
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

class MarkdownErrorBoundary extends Component<
  { content: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <p className="whitespace-pre-wrap">{this.props.content}</p>;
    }
    return this.props.children;
  }
}

function MarkdownWithErrorBoundary({ content }: { content: string }) {
  return (
    <MarkdownErrorBoundary content={content}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm as never]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code({ className, children, ...props }) {
            const text = String(children ?? '').replace(/\n$/, '');
            const isBlock = typeof className === 'string' && className.includes('language-');
            if (isBlock) {
              return <CodeBlock className={className}>{text}</CodeBlock>;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}

