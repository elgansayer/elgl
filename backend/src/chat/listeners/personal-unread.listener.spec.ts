import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalUnreadListener } from './personal-unread.listener';

describe('PersonalUnreadListener', () => {
  const publish = vi.fn();
  let listener: PersonalUnreadListener;

  beforeEach(() => {
    vi.clearAllMocks();
    publish.mockResolvedValue(true);
    listener = new PersonalUnreadListener({ publish } as never);
  });

  it('publishes a count-only invalidation to the authenticated user channel', async () => {
    await listener.handleCountsChanged({
      recipientId: 'user-1',
      source: 'notifications',
    });

    expect(publish).toHaveBeenCalledWith('user_user-1', {
      type: 'unread_counts_changed',
      source: 'notifications',
    });
  });

  it('does not reject the persisted flow when realtime delivery is unavailable', async () => {
    publish.mockResolvedValue(false);

    await expect(
      listener.handleCountsChanged({
        recipientId: 'user-1',
        source: 'chat',
      }),
    ).resolves.toBeUndefined();
  });
});
