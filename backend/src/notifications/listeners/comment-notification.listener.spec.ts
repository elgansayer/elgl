import type { Mock } from 'vitest';
import { MomentCommentEvent } from '../events/notification.events';
import { CommentNotificationListener } from './comment-notification.listener';

type PreferenceCheck = (
  userId: string,
  category: string,
  channel: string,
) => Promise<boolean>;

describe('CommentNotificationListener', () => {
  const authorId = 'author-1';
  const commenterId = 'commenter-1';
  let createNotification: ReturnType<typeof vi.fn>;
  let sendPushNotification: ReturnType<typeof vi.fn>;
  let shouldSendNotification: Mock<PreferenceCheck>;
  let listener: CommentNotificationListener;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    createNotification = vi.fn().mockResolvedValue(undefined);
    sendPushNotification = vi.fn().mockResolvedValue('sent');
    shouldSendNotification = vi.fn<PreferenceCheck>().mockResolvedValue(true);
    listener = new CommentNotificationListener(
      { createNotification, sendPushNotification } as never,
      { shouldSendNotification } as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores an inbox comment for the moment author without a duplicate push', async () => {
    await listener.handleCommentMoment(
      new MomentCommentEvent('moment-1', commenterId, authorId, 'Nice!'),
    );

    expect(createNotification).toHaveBeenCalledWith(
      authorId,
      commenterId,
      'comment_moment',
      'moment-1',
      'Nice!',
      false,
    );
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      authorId,
      expect.objectContaining({ type: 'comment_moment', body: 'Nice!' }),
    );
  });

  it('labels a reply to the author as a reply', async () => {
    await listener.handleCommentMoment(
      new MomentCommentEvent(
        'moment-1',
        commenterId,
        authorId,
        'Thanks',
        'parent-1',
        authorId,
      ),
    );

    expect(createNotification).toHaveBeenCalledWith(
      authorId,
      commenterId,
      'reply_comment',
      'moment-1',
      'Thanks',
      false,
    );
  });

  it('labels a reply to someone else as a comment on the author moment', async () => {
    await listener.handleCommentMoment(
      new MomentCommentEvent(
        'moment-1',
        commenterId,
        authorId,
        'Agreed',
        'parent-1',
        'other-user',
      ),
    );

    expect(createNotification).toHaveBeenCalledWith(
      authorId,
      commenterId,
      'comment_moment',
      'moment-1',
      'Agreed',
      false,
    );
  });

  it('ignores comments written by the moment author', async () => {
    await listener.handleCommentMoment(
      new MomentCommentEvent('moment-1', authorId, authorId, 'Self note'),
    );

    expect(shouldSendNotification).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('respects a disabled in-app preference while still pushing', async () => {
    shouldSendNotification.mockImplementation(
      (_userId: string, _category: string, channel: string) =>
        Promise.resolve(channel !== 'in_app'),
    );

    await listener.handleCommentMoment(
      new MomentCommentEvent('moment-1', commenterId, authorId, 'Nice!'),
    );

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
  });

  it('respects a disabled push preference while keeping the inbox item', async () => {
    shouldSendNotification.mockImplementation(
      (_userId: string, _category: string, channel: string) =>
        Promise.resolve(channel !== 'push'),
    );

    await listener.handleCommentMoment(
      new MomentCommentEvent('moment-1', commenterId, authorId, 'Nice!'),
    );

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('fails closed when preferences are unavailable', async () => {
    shouldSendNotification.mockRejectedValue(new Error('database unavailable'));

    await expect(
      listener.handleCommentMoment(
        new MomentCommentEvent('moment-1', commenterId, authorId, 'Nice!'),
      ),
    ).resolves.toBeUndefined();

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});
