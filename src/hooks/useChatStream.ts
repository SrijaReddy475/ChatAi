import { CHAT_FUNCTION_URL } from '../lib/supabase';
import type { Tone } from '../lib/types';

export interface StreamHandlers {
  onTitle: (title: string) => void;
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

interface StartStreamArgs {
  conversationId: string;
  message: string;
  tone: Tone;
  signal: AbortSignal;
  handlers: StreamHandlers;
}

function parseSseChunk(chunk: string, onEvent: (event: string, data: string) => void) {
  const events = chunk.split('\n\n');
  for (const evt of events) {
    let event = '';
    const dataLines: string[] = [];
    for (const line of evt.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!event || dataLines.length === 0) continue;
    const raw = dataLines.join('\n');
    // Payloads are JSON-encoded so embedded newlines survive the SSE frame.
    try {
      onEvent(event, JSON.parse(raw) as string);
    } catch {
      onEvent(event, raw);
    }
  }
}

export async function startChatStream({
  conversationId,
  message,
  tone,
  signal,
  handlers,
}: StartStreamArgs): Promise<void> {
  try {
    const response = await fetch(CHAT_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ conversationId, message, tone }),
      signal,
    });

    if (!response.ok || !response.body) {
      let detail = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) detail = body.error;
      } catch {
        /* non-JSON error body */
      }
      handlers.onError(detail);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let errored = false;
    let finished = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let lastBreak = buffer.lastIndexOf('\n\n');
      while (lastBreak !== -1) {
        const ready = buffer.slice(0, lastBreak);
        buffer = buffer.slice(lastBreak + 2);
        parseSseChunk(ready, (event, data) => {
          switch (event) {
            case 'title':
              handlers.onTitle(data);
              break;
            case 'token':
              full += data;
              handlers.onToken(data);
              break;
            case 'done':
              finished = true;
              handlers.onDone(full);
              break;
            case 'error':
              errored = true;
              handlers.onError(data || 'The assistant hit an unexpected error.');
              break;
          }
        });
        lastBreak = buffer.lastIndexOf('\n\n');
      }
    }

    if (!finished && !errored && full.length > 0) {
      // Stream ended without an explicit done event; persist what arrived.
      handlers.onDone(full);
    } else if (!finished && !errored && full.length === 0) {
      handlers.onError('The connection ended before any response arrived.');
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // Deliberate abort: onDone has already been handled by the caller
      // via savePartial(). Nothing to surface to the UI.
      return;
    }
    handlers.onError(
      'Lost connection to the assistant. Check your network and try again.'
    );
  }
}
