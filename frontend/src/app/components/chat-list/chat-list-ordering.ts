export interface ChatPriorityPreview {
  isPinned: boolean;
  lastMessageAt: string | null;
}

/**
 * Keep pinned conversations at the top of the inbox while preserving the
 * existing newest-message-first ordering inside each priority group.
 */
export function compareChatPriority(
  a: ChatPriorityPreview,
  b: ChatPriorityPreview,
): number {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }

  if (!a.lastMessageAt && !b.lastMessageAt) return 0;
  if (!a.lastMessageAt) return 1;
  if (!b.lastMessageAt) return -1;
  return b.lastMessageAt.localeCompare(a.lastMessageAt);
}
