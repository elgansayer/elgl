import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSystemEventListener } from './chat-system-event.listener';

describe('ChatSystemEventListener', () => {
  const publishToAllUserRooms = vi.fn();
  const publishToDirectRoom = vi.fn();
  const maybeSingle = vi.fn();

  let listener: ChatSystemEventListener;

  beforeEach(() => {
    vi.clearAllMocks();
    publishToAllUserRooms.mockResolvedValue(undefined);
    publishToDirectRoom.mockResolvedValue(undefined);
    maybeSingle.mockResolvedValue({
      data: { display_name: 'Language Partner' },
      error: null,
    });

    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    listener = new ChatSystemEventListener(
      { publishToAllUserRooms, publishToDirectRoom } as never,
      { getClient: vi.fn().mockReturnValue({ from }) } as never,
    );
  });

  it('enriches profile updates with the current display name', async () => {
    await listener.handleProfileUpdated({ userId: 'user-1' });

    expect(publishToAllUserRooms).toHaveBeenCalledWith(
      'user-1',
      'profileUpdated',
      { name: 'Language Partner' },
    );
  });

  it('enriches missed calls with caller display name and media type', async () => {
    await listener.handleCallMissed({
      callerId: 'caller-1',
      calleeId: 'callee-1',
      isVideo: true,
    });

    expect(publishToDirectRoom).toHaveBeenCalledWith(
      'caller-1',
      'callee-1',
      'missedCall',
      { isVideo: true, name: 'Language Partner' },
    );
  });

  it('degrades safely when the profile lookup is unavailable', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(
      listener.handleCallMissed({
        callerId: 'caller-1',
        calleeId: 'callee-1',
        isVideo: false,
      }),
    ).resolves.toBeUndefined();

    expect(publishToDirectRoom).toHaveBeenCalledWith(
      'caller-1',
      'callee-1',
      'missedCall',
      { isVideo: false },
    );
  });

  it('trims and bounds display names before publishing them', async () => {
    maybeSingle.mockResolvedValue({
      data: { display_name: `  ${'x'.repeat(120)}  ` },
      error: null,
    });

    await listener.handleProfileUpdated({ userId: 'user-1' });

    const params = publishToAllUserRooms.mock.calls[0]?.[2] as {
      name: string;
    };
    expect(params.name).toHaveLength(80);
    expect(params.name).toBe('x'.repeat(80));
  });
});
