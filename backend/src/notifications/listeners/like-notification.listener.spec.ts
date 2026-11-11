import type { Mock } from 'vitest';
import { LikeEvent } from '../events/notification.events';
import { LikeNotificationListener } from './like-notification.listener';

type PreferenceCheck = (
  userId: string,
  category: string,
  channel: string,
) => Promise<boolean>;

describe('LikeNotificationListener', () => {
  const authorId = 'author-1';
  const likerId = 'liker-1';
  let createNotification: ReturnType<typeof vi.fn>;
  let hasNotification: ReturnType<typeof vi.fn>;
  let sendPushNotification: ReturnType<typeof vi.fn>;
  let shouldSendNotification: Mock<PreferenceCheck>;
  let listener: LikeNotificationListener;

  beforeEach(() => {
    createNotification = vi.fn().mockResolvedValue(undefined);
    hasNotification = vi.fn().mockResolvedValue(false);
    sendPushNotification = vi.fn().mockResolvedValue('sent');
    shouldSendNotification = vi.fn<PreferenceCheck>().mockResolvedValue(true);
    listener = new LikeNotificationListener(
      { createNotification, hasNotification, sendPushNotification } as never,
      { shouldSendNotification } as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores an inbox like for a moment author and pushes exactly once', async () => {
    await listener.handleLike(
      new LikeEvent(likerId, authorId, 'moment', 'm-1'),
    );

    expect(hasNotification).toHaveBeenCalledWith(
      authorId,
      likerId,
      'like_moment',
      'm-1',
    );
    expect(createNotification).toHaveBeenCalledWith(
      authorId,
      likerId,
      'like_moment',
      'm-1',
      undefined,
      false,
    );
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      authorId,
      expect.objectContaining({
        type: 'like_moment',
        body: 'Someone liked your moment',
        category: 'likes',
      }),
    );
  });

  it('stores profile likes with the profile type and copy', async () => {
    await listener.handleLike(new LikeEvent(likerId, authorId, 'profile'));

    expect(createNotification).toHaveBeenCalledWith(
      authorId,
      likerId,
      'like_profile',
      undefined,
      undefined,
      false,
    );
    expect(sendPushNotification).toHaveBeenCalledWith(
      authorId,
      expect.objectContaining({ body: 'Someone liked your profile' }),
    );
  });

  it('does not re-notify when the same actor already liked the same moment', async () => {
    hasNotification.mockResolvedValue(true);

    await listener.handleLike(
      new LikeEvent(likerId, authorId, 'moment', 'm-1'),
    );

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('ignores self likes without reading preferences', async () => {
    await listener.handleLike(
      new LikeEvent(authorId, authorId, 'moment', 'm-1'),
    );

    expect(shouldSendNotification).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('respects a disabled in-app preference while still pushing', async () => {
    shouldSendNotification.mockImplementation(
      (_userId: string, _category: string, channel: string) =>
        Promise.resolve(channel !== 'in_app'),
    );

    await listener.handleLike(
      new LikeEvent(likerId, authorId, 'moment', 'm-1'),
    );

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
  });

  it('respects a disabled push preference while keeping the inbox item', async () => {
    shouldSendNotification.mockImplementation(
      (_userId: string, _category: string, channel: string) =>
        Promise.resolve(channel !== 'push'),
    );

    await listener.handleLike(
      new LikeEvent(likerId, authorId, 'moment', 'm-1'),
    );

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('does nothing when every channel is disabled', async () => {
    shouldSendNotification.mockResolvedValue(false);

    await listener.handleLike(
      new LikeEvent(likerId, authorId, 'moment', 'm-1'),
    );

    expect(hasNotification).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('fails closed when preferences are unavailable', async () => {
    shouldSendNotification.mockRejectedValue(new Error('database unavailable'));

    await expect(
      listener.handleLike(new LikeEvent(likerId, authorId, 'moment', 'm-1')),
    ).resolves.toBeUndefined();

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});
