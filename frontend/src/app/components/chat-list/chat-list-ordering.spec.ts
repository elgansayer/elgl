import { describe, expect, it } from 'vitest';
import { compareChatPriority, type ChatPriorityPreview } from './chat-list-ordering';

const preview = (isPinned: boolean, lastMessageAt: string | null): ChatPriorityPreview => ({
  isPinned,
  lastMessageAt,
});

describe('compareChatPriority', () => {
  it('keeps pinned chats above newer unpinned chats', () => {
    const pinned = preview(true, '2026-01-01T00:00:00.000Z');
    const unpinned = preview(false, '2026-08-28T00:00:00.000Z');

    expect(compareChatPriority(pinned, unpinned)).toBeLessThan(0);
    expect(compareChatPriority(unpinned, pinned)).toBeGreaterThan(0);
  });

  it('orders conversations within the same priority group by newest message first', () => {
    const newest = preview(true, '2026-08-28T10:00:00.000Z');
    const older = preview(true, '2026-08-27T10:00:00.000Z');

    expect(compareChatPriority(newest, older)).toBeLessThan(0);
    expect(compareChatPriority(older, newest)).toBeGreaterThan(0);
  });

  it('keeps message-less chats after chats with activity inside the same priority group', () => {
    const active = preview(false, '2026-08-28T10:00:00.000Z');
    const empty = preview(false, null);

    expect(compareChatPriority(active, empty)).toBeLessThan(0);
    expect(compareChatPriority(empty, active)).toBeGreaterThan(0);
    expect(compareChatPriority(empty, preview(false, null))).toBe(0);
  });
});
