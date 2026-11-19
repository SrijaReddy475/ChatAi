import { describe, expect, it } from 'vitest';
import { relativeTime, groupConversations } from './ui-utils';
import { getToneConfig, TONE_LIST } from './tones';

describe('relativeTime', () => {
  it('labels fresh timestamps as Just now', () => {
    expect(relativeTime(new Date().toISOString())).toBe('Just now');
  });
  it('labels minutes and hours correctly', () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5m ago');
    expect(relativeTime(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('3h ago');
  });
});

describe('groupConversations', () => {
  const mk = (id: string, updated_at: string, pinned = false) => ({
    id,
    title: id,
    tone: 'professional' as const,
    pinned,
    created_at: updated_at,
    updated_at,
  });

  it('groups by today, yesterday, previous 7 days and older', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 31 * 86400000);
    const groups = groupConversations([
      mk('old', thirtyDaysAgo.toISOString()),
      mk('week', threeDaysAgo.toISOString()),
      mk('yest', yesterday.toISOString()),
      mk('today', now.toISOString()),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Previous 7 days', 'Older']);
  });

  it('puts pinned conversations in a Pinned group first', () => {
    const now = new Date();
    const groups = groupConversations([
      mk('a', now.toISOString()),
      mk('p', now.toISOString(), true),
    ]);
    expect(groups[0].label).toBe('Pinned');
    expect(groups[0].conversations[0].id).toBe('p');
  });
});

describe('tone config', () => {
  it('exposes exactly three tones with unique instructions', () => {
    expect(TONE_LIST).toHaveLength(3);
    const set = new Set(TONE_LIST.map((t) => t.systemInstruction));
    expect(set.size).toBe(3);
  });

  it('falls back to professional for unknown values', () => {
    expect(getToneConfig('snarky').id).toBe('professional');
    expect(getToneConfig(undefined).id).toBe('professional');
  });
});
