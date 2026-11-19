export type Tone = 'professional' | 'casual' | 'concise';

export const BASE_SYSTEM_PROMPT =
  'You are Vibe Chat, a sharp, helpful AI assistant with great taste. Format answers in Markdown when structure helps.';

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional:
    'Respond in a polished, formal, business-appropriate tone. Use precise language, structured paragraphs, and no slang or emojis.',
  casual:
    'Respond like a friendly, witty friend. Conversational, relaxed, contractions and light humour welcome, emojis sparingly.',
  concise:
    'Respond as briefly as possible. Maximum 3 sentences or a short bullet list. No preamble, no filler.',
};

export function buildSystemPrompt(tone: Tone): string {
  return `${BASE_SYSTEM_PROMPT}\n\nVibe check — ${TONE_INSTRUCTIONS[tone]}`;
}

export function titlePrompt(firstMessage: string, firstReply: string): string {
  return `Generate a 3-6 word title summarizing this conversation. Reply with ONLY the title, no quotes, no punctuation at the end.\n\nUser: ${firstMessage.slice(0, 500)}\nAssistant: ${firstReply.slice(0, 500)}`;
}

export function isValidTone(value: unknown): value is Tone {
  return value === 'professional' || value === 'casual' || value === 'concise';
}
