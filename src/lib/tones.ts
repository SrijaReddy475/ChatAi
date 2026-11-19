import type { Tone, ToneConfig } from './types';

export const BASE_SYSTEM_PROMPT =
  'You are Vibe Chat, a sharp, helpful AI assistant with great taste. Format answers in Markdown when structure helps.';

/**
 * The single source of truth for the Vibe Check tone system.
 * The backend appends `systemInstruction` to the base system prompt,
 * and the frontend applies `ui` so the theme shifts with the tone.
 */
export const TONES: Record<Tone, ToneConfig> = {
  professional: {
    id: 'professional',
    label: 'Professional',
    icon: 'hat',
    badge: 'Professional',
    systemInstruction:
      'Respond in a polished, formal, business-appropriate tone. Use precise language, structured paragraphs, and no slang or emojis.',
    ui: {
      accent: 'bg-zinc-900 text-white hover:bg-zinc-700',
      accentSoft: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/25 dark:text-zinc-300',
      bubble: 'bg-zinc-100 dark:bg-[#232329] rounded-2xl',
      ring: 'ring-zinc-400/50',
      dot: 'text-zinc-500',
      caret: 'text-zinc-500',
    },
  },
  casual: {
    id: 'casual',
    label: 'Casual',
    icon: 'sunglasses',
    badge: 'Casual',
    systemInstruction:
      'Respond like a friendly, witty friend. Conversational, relaxed, contractions and light humour welcome, emojis sparingly.',
    ui: {
      accent: 'bg-amber-600 text-white hover:bg-amber-500',
      accentSoft: 'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300',
      bubble: 'bg-amber-50/60 dark:bg-[#26231f] rounded-2xl',
      ring: 'ring-amber-400/50',
      dot: 'text-amber-500',
      caret: 'text-amber-500',
    },
  },
  concise: {
    id: 'concise',
    label: 'Concise',
    icon: 'zap',
    badge: 'Concise',
    systemInstruction:
      'Respond as briefly as possible. Maximum 3 sentences or a short bullet list. No preamble, no filler.',
    ui: {
      accent: 'bg-emerald-700 text-white hover:bg-emerald-600',
      accentSoft: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
      bubble: 'bg-emerald-50/50 dark:bg-[#1e2622] rounded-2xl',
      ring: 'ring-emerald-400/50',
      dot: 'text-emerald-600',
      caret: 'text-emerald-500',
    },
  },
};

export const TONE_LIST: ToneConfig[] = [TONES.professional, TONES.casual, TONES.concise];

export function isTone(value: unknown): value is Tone {
  return typeof value === 'string' && value in TONES;
}

export function getToneConfig(value: unknown): ToneConfig {
  return isTone(value) ? TONES[value] : TONES.professional;
}
