import { Test, TestingModule } from '@nestjs/testing';
import { CommentMentionNotificationListener } from './comment-mention-notification.listener';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { MomentCommentEvent } from '../events/notification.events';

describe('CommentMentionNotificationListener', () => {
  let listener: CommentMentionNotificationListener;
  let notificationsService: NotificationsService;
  let notificationPreferencesService: NotificationPreferencesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentMentionNotificationListener,
        {
          provide: NotificationsService,
          useValue: {
            createNotification: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationPreferencesService,
          useValue: {
            shouldSendNotification: vi.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    listener = module.get<CommentMentionNotificationListener>(
      CommentMentionNotificationListener,
    );
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
    notificationPreferencesService = module.get<NotificationPreferencesService>(
      NotificationPreferencesService,
    );
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  it('should create a notification when comment mentions a user via mentionedUserIds', async () => {
    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'moment-author-1',
      'Hey @mentioned_user check this out',
      undefined,
      undefined,
      ['mentioned-user-1'],
    );

    await listener.handleCommentMention(payload);

    expect(
      notificationPreferencesService.shouldSendNotification,
    ).toHaveBeenCalledWith('mentioned-user-1', 'moment_comment', 'push');
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'mentioned-user-1',
      'commenter-1',
      'mention_comment',
      'moment-1',
      'Hey @mentioned_user check this out',
    );
  });

  it('should create notifications for multiple mentioned users', async () => {
    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'moment-author-1',
      'Hey @alice and @bob check this out',
      undefined,
      undefined,
      ['mentioned-user-1', 'mentioned-user-2'],
    );

    await listener.handleCommentMention(payload);

    expect(
      notificationPreferencesService.shouldSendNotification,
    ).toHaveBeenCalledTimes(2);
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
  });

  it('should fall back to momentAuthorId for backward compatibility', async () => {
    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'mentioned-user-1',
      'Hey @user',
    );

    await listener.handleCommentMention(payload);

    expect(
      notificationPreferencesService.shouldSendNotification,
    ).toHaveBeenCalledWith('mentioned-user-1', 'moment_comment', 'push');
    expect(notificationsService.createNotification).toHaveBeenCalled();
  });

  it('should skip notification when preferences disable push', async () => {
    vi.spyOn(
      notificationPreferencesService,
      'shouldSendNotification',
    ).mockResolvedValue(false);

    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'moment-author-1',
      'Hey @user',
      undefined,
      undefined,
      ['mentioned-user-1'],
    );

    await listener.handleCommentMention(payload);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('should still send notification if preference check fails', async () => {
    vi.spyOn(
      notificationPreferencesService,
      'shouldSendNotification',
    ).mockRejectedValue(new Error('DB error'));

    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'moment-author-1',
      'Hey @user',
      undefined,
      undefined,
      ['mentioned-user-1'],
    );

    await listener.handleCommentMention(payload);

    expect(notificationsService.createNotification).toHaveBeenCalled();
  });

  it('should skip self-mention (commenter mentioning themselves)', async () => {
    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'moment-author-1',
      'Hey @me check this',
      undefined,
      undefined,
      ['commenter-1'],
    );

    await listener.handleCommentMention(payload);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });
});
