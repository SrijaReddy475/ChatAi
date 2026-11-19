import { Zap, Glasses, Briefcase } from 'lucide-react';
import { TONE_LIST } from '../lib/tones';
import type { Tone } from '../lib/types';

const ICONS = {
  hat: Briefcase,
  sunglasses: Glasses,
  zap: Zap,
} as const;

interface ToneToggleProps {
  value: Tone;
  onChange: (tone: Tone) => void;
}

export function ToneToggle({ value, onChange }: ToneToggleProps) {
  const activeIndex = TONE_LIST.findIndex((t) => t.id === value);
  return (
    <div
      role="radiogroup"
      aria-label="Response tone"
      className="relative flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-white/10 dark:bg-white/5"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-lg bg-white shadow-sm ring-1 ring-zinc-200 transition-all duration-300 dark:bg-white/10 dark:ring-white/10"
        style={{
          width: 'calc((100% - 0.5rem) / 3)',
          left: `calc(0.25rem + ${activeIndex} * (100% - 0.5rem) / 3)`,
        }}
      />
      {TONE_LIST.map((tone) => {
        const Icon = ICONS[tone.icon];
        const selected = tone.id === value;
        return (
          <button
            key={tone.id}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(tone.id)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition sm:text-[13px] ${
              selected
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Icon size={14} className={selected ? tone.ui.dot.replace('bg-', 'text-') : undefined} />
            <span>{tone.label}</span>
          </button>
        );
      })}
    </div>
  );
}
