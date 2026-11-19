import { isValidTone, type Tone } from './tone-prompts.ts';
import { streamChat, generateTitle } from './ai-provider.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const CONTEXT_WINDOW = 20;

/** SSE frames must carry JSON-encoded data so newlines survive transport. */
function sse(event: string, data: string): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function userErrorMessage(code: string): string {
  switch (code) {
    case 'GEMINI_API_KEY_MISSING':
      return 'Gemini API key missing or request failed. Add GEMINI_API_KEY and try again.';
    case 'GEMINI_KEY_INVALID':
      return 'Gemini API key missing or request failed. The configured key was rejected.';
    case 'GEMINI_RATE_LIMITED':
      return 'The assistant is rate limited right now. Give it a moment and retry.';
    default:
      return 'Gemini API key missing or request failed. Please try again.';
  }
}

interface ParsedBody {
  conversationId?: string;
  message?: string;
  tone?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonError(405, 'Method not allowed');
  }

  let body: ParsedBody;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const { conversationId, message, tone } = body;
  if (typeof conversationId !== 'string' || conversationId.length < 10) {
    return jsonError(400, 'conversationId is required');
  }
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 8000) {
    return jsonError(400, 'message must be between 1 and 8000 characters');
  }
  if (!isValidTone(tone)) {
    return jsonError(400, "tone must be 'professional', 'casual' or 'concise'");
  }
  const selectedTone = tone as Tone;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();
  if (convError || !conversation) {
    return jsonError(404, 'Conversation not found');
  }

  const { data: history, error: historyError } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (historyError) {
    return jsonError(500, 'Could not load conversation history');
  }

  const priorMessages = (history ?? []) as { role: 'user' | 'assistant'; content: string }[];
  // Last N messages give the model coherent context.
  const recent = priorMessages.slice(-CONTEXT_WINDOW);
  const upstreamMessages = [...recent, { role: 'user' as const, content: message }];

  // Abort upstream when the client disconnects (Stop button / tab close).
  const upstreamController = new AbortController();
  req.signal.addEventListener('abort', () => upstreamController.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: string) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      let full = '';

      try {
        for await (const evt of streamChat({
          messages: upstreamMessages,
          tone: selectedTone,
          signal: upstreamController.signal,
        })) {
          if (upstreamController.signal.aborted) break;
          if (evt.text) {
            full += evt.text;
            send('token', evt.text);
          }
        }

        if (!upstreamController.signal.aborted) {
          // Persist the full response, then bump the thread's recency.
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: full,
            tone: selectedTone,
          });

          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          // After the first exchange, auto-title the thread (sidebar + typewriter).
          if (priorMessages.length === 0 && full.trim()) {
            const title = await generateTitle(message, full);
            if (title) {
              patch.title = title;
              send('title', title);
            }
          }
          await supabase.from('conversations').update(patch).eq('id', conversationId);

          send('done', full);
        } else if (full.trim()) {
          // Client aborted mid-stream: save the partial, marked interrupted.
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: full,
            tone: selectedTone,
            interrupted: true,
          });
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      } catch (err) {
        console.error('[chat] streaming failed:', err?.message ?? err);
        if (full.trim()) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: full,
            tone: selectedTone,
            interrupted: true,
          });
        }
        if (!upstreamController.signal.aborted) {
          send('error', userErrorMessage(String(err?.message ?? err)));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
});
