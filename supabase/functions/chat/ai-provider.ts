import { buildSystemPrompt, titlePrompt, type Tone } from './tone-prompts.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChatArgs {
  messages: ProviderMessage[];
  tone: Tone;
  signal: AbortSignal;
}

export interface ProviderEvent {
  text?: string;
}

/**
 * Streams a Gemini response as an async generator of text deltas.
 * Uses the Gemini REST SSE endpoint (streamGenerateContent?alt=sse) —
 * the web-native way to talk to Gemini from a Deno edge function.
 * Swap this file for another provider to change AI backends.
 */
export async function* streamChat({
  messages,
  tone,
  signal,
}: StreamChatArgs): AsyncGenerator<ProviderEvent> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const system = buildSystemPrompt(tone);
  const contents = messages.map((m) => ({
    // Gemini roles are "user" and "model" — never "assistant".
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `${BASE_URL}/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      signal,
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  );

  if (response.status === 400) {
    throw new Error('GEMINI_KEY_INVALID');
  }
  if (response.status === 429) {
    throw new Error('GEMINI_RATE_LIMITED');
  }
  if (!response.ok || !response.body) {
    console.error('[aiProvider] Gemini error', response.status, await response.text().catch(() => ''));
    throw new Error('GEMINI_REQUEST_FAILED');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const payload = line.startsWith('data:') ? line.slice(5).trim() : null;
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = evt.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (text) yield { text };
      } catch {
        // Ignore malformed keepalive lines.
      }
    }
  }
}

/** Cheap, separate, non-streamed call used to title a thread. */
export async function generateTitle(
  firstMessage: string,
  firstReply: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const response = await fetch(`${BASE_URL}/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      signal,
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: titlePrompt(firstMessage, firstReply) }] }],
        generationConfig: { maxOutputTokens: 24, temperature: 0.3 },
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const title = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return title ? title.replace(/^["']|["']$/g, '').slice(0, 60) : null;
  } catch {
    return null;
  }
}
