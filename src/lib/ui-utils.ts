import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, ThreadGroup } from './types';

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function groupConversations(conversations: Conversation[]): ThreadGroup[] {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 6 * 86400000;

  const groups: Record<string, Conversation[]> = {
    Pinned: [],
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  };

  for (const c of [...conversations].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )) {
    if (c.pinned) {
      groups.Pinned.push(c);
      continue;
    }
    const t = startOfDay(new Date(c.updated_at)).getTime();
    if (t >= today) groups.Today.push(c);
    else if (t >= yesterday) groups.Yesterday.push(c);
    else if (t >= weekAgo) groups['Previous 7 days'].push(c);
    else groups.Older.push(c);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, conversations: items }));
}

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Smoothly reveals `target` text character by character using rAF. */
export function useTypewriter(target: string, enabled: boolean) {
  const [text, setText] = useState(enabled ? '' : target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setText(target);
      return;
    }
    setText('');
    let start: number | null = null;
    const charsPerFrame = Math.max(1, Math.ceil(target.length / 45));
    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsedFrames = Math.floor((ts - start) / 16.7);
      const count = elapsedFrames * charsPerFrame;
      setText(count >= target.length ? target : target.slice(0, count));
      if (count < target.length) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, enabled]);

  return text;
}

export function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), timeout);
  }, [timeout]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { copied, copy };
}
