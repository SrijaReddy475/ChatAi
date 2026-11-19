export type Tone = 'professional' | 'casual' | 'concise';
export type Role = 'user' | 'assistant';

export interface Conversation {
  id: string;
  title: string;
  tone: Tone;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id?: string;
  role: Role;
  content: string;
  tone: Tone;
  interrupted?: boolean;
  tokens_used?: number | null;
  created_at: string;
  /** Client-only marker for the optimistic user bubble. */
  pending?: boolean;
}

export type ToneIconName = 'hat' | 'sunglasses' | 'zap';

export interface ToneConfig {
  id: Tone;
  label: string;
  icon: ToneIconName;
  badge: string;
  /** The exact instruction appended to the system prompt for this tone. */
  systemInstruction: string;
  /** Tailwind classes for the tone's visual theme. */
  ui: {
    accent: string;
    accentSoft: string;
    bubble: string;
    ring: string;
    dot: string;
    caret: string;
  };
}

export interface ThreadGroup {
  label: string;
  conversations: Conversation[];
}
