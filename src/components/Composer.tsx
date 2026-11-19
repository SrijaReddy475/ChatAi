import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { ToneToggle } from './ToneToggle';
import type { Tone } from '../lib/types';

interface ComposerProps {
  tone: Tone;
  onToneChange: (tone: Tone) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
}

export function Composer({ tone, onToneChange, onSend, onStop, streaming }: ComposerProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
    setValue('');
  };

  return (
    <div className="w-full">
      <ToneToggle value={tone} onChange={onToneChange} />
      <div
        className={`mt-2 rounded-2xl border border-zinc-200 bg-white shadow-sm transition focus-within:border-zinc-400 dark:border-white/10 dark:bg-[#1e1e26] dark:focus-within:border-white/25`}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={streaming}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message Vibe Chat…"
          className="scrollbar-thin max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-zinc-400 disabled:opacity-60"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <span className="text-[11px] text-zinc-400">
            <kbd className="rounded border border-zinc-300 px-1 font-sans dark:border-white/15">Enter</kbd> to
            send · <kbd className="rounded border border-zinc-300 px-1 font-sans dark:border-white/15">Shift+Enter</kbd> for
            new line
          </span>
          {streaming ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              <Square size={12} fill="currentColor" /> Stop generating
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
