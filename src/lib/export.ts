import type { ChatMessage, Conversation } from './types';
import { getToneConfig } from './tones';

export function exportConversationMarkdown(
  conversation: Conversation,
  messages: ChatMessage[]
): void {
  const lines: string[] = [
    `# ${conversation.title}`,
    '',
    `*Exported from Vibe Chat — ${new Date().toLocaleString()}*`,
    '',
  ];
  for (const m of messages) {
    if (m.pending || !m.content) continue;
    lines.push(`### ${m.role === 'user' ? 'You' : 'Vibe Chat'}${m.role === 'assistant' ? ` (${getToneConfig(m.tone).badge})` : ''}`);
    lines.push('', m.content, '');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${conversation.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'vibe-chat'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
