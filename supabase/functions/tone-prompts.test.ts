import { BASE_SYSTEM_PROMPT, buildSystemPrompt, TONE_INSTRUCTIONS, isValidTone } from '../chat/tone-prompts.ts';

let failures = 0;
function check(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}`);
  }
}

check('professional maps to its exact instruction', buildSystemPrompt('professional').includes(TONE_INSTRUCTIONS.professional));
check('casual maps to its exact instruction', buildSystemPrompt('casual').includes(TONE_INSTRUCTIONS.casual));
check('concise maps to its exact instruction', buildSystemPrompt('concise').includes(TONE_INSTRUCTIONS.concise));
check('base prompt is always present', (['professional', 'casual', 'concise'] as const).every((t) => buildSystemPrompt(t).startsWith(BASE_SYSTEM_PROMPT)));
check('professional prompt excludes casual wording', !buildSystemPrompt('professional').includes('witty friend'));
check('casual prompt excludes concise wording', !buildSystemPrompt('casual').includes('Maximum 3 sentences'));
check('concise prompt excludes professional wording', !buildSystemPrompt('concise').includes('business-appropriate'));
check('invalid tone rejected', !isValidTone('snarky') && !isValidTone(42));
check('valid tones accepted', isValidTone('professional') && isValidTone('casual') && isValidTone('concise'));

if (failures > 0) {
  console.error(`${failures} tone-mapping test(s) failed`);
  Deno.exit(1);
}
console.log('All tone-mapping tests passed.');
