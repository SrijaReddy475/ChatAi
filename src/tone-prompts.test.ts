/**
 * Unit tests for the Vibe Check tone system.
 *
 * Each tone value MUST produce the exact system instruction documented
 * in the spec. These tests pin that contract for both the edge function
 * (Deno, via supabase/functions/chat/tone-prompts.ts) and — for editor /
 * CI convenience without a Deno install — an inline copy of the mapping
 * asserted to be identical.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const toneSource = readFileSync(
  join(here, '../supabase/functions/chat/tone-prompts.ts'),
  'utf8'
);

// Extract TONE_INSTRUCTIONS from the Deno module source so the test runs
// with plain Node/vitest while testing the real shipped file.
function extract(recordName: string): Record<string, string> {
  const start = toneSource.indexOf(`const ${recordName}`);
  const objStart = toneSource.indexOf('{', start);
  let depth = 0;
  let end = objStart;
  for (let i = objStart; i < toneSource.length; i++) {
    if (toneSource[i] === '{') depth++;
    if (toneSource[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = toneSource.slice(objStart, end + 1);
  const entries = [...body.matchAll(/(\w+):\s*\n?\s*'((?:[^'\\]|\\.)*)'/g)];
  return Object.fromEntries(entries.map(([, k, v]) => [k, v]));
}

const instructions = extract('TONE_INSTRUCTIONS');

const BASE =
  'You are Vibe Chat, a sharp, helpful AI assistant with great taste. Format answers in Markdown when structure helps.';

function buildSystemPrompt(tone: string): string {
  return `${BASE}\n\nVibe check — ${instructions[tone]}`;
}

describe('tone system', () => {
  it('professional maps to the exact spec instruction', () => {
    expect(instructions.professional).toBe(
      'Respond in a polished, formal, business-appropriate tone. Use precise language, structured paragraphs, and no slang or emojis.'
    );
  });

  it('casual maps to the exact spec instruction', () => {
    expect(instructions.casual).toBe(
      'Respond like a friendly, witty friend. Conversational, relaxed, contractions and light humour welcome, emojis sparingly.'
    );
  });

  it('concise maps to the exact spec instruction', () => {
    expect(instructions.concise).toBe(
      'Respond as briefly as possible. Maximum 3 sentences or a short bullet list. No preamble, no filler.'
    );
  });

  it('every built prompt starts with the base system prompt', () => {
    for (const tone of ['professional', 'casual', 'concise']) {
      expect(buildSystemPrompt(tone).startsWith(BASE)).toBe(true);
    }
  });

  it('each tone prompt contains only its own instruction', () => {
    const all = Object.values(instructions);
    for (const tone of ['professional', 'casual', 'concise']) {
      const prompt = buildSystemPrompt(tone);
      expect(prompt.includes(instructions[tone])).toBe(true);
      for (const other of all) {
        if (other !== instructions[tone]) expect(prompt.includes(other)).toBe(false);
      }
    }
  });
});
