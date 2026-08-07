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
            createNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationPreferencesService,
          useValue: {
            shouldSendNotification: jest.fn().mockResolvedValue(true),
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

  it('should create a notification when comment mentions a user', async () => {
    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'mentioned-user-1',
      'Hey @mentioned_user check this out',
      undefined,
      undefined,
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

  it('should skip notification when preferences disable push', async () => {
    jest
      .spyOn(notificationPreferencesService, 'shouldSendNotification')
      .mockResolvedValue(false);

    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'mentioned-user-1',
      'Hey @user',
    );

    await listener.handleCommentMention(payload);

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('should still send notification if preference check fails', async () => {
    jest
      .spyOn(notificationPreferencesService, 'shouldSendNotification')
      .mockRejectedValue(new Error('DB error'));

    const payload = new MomentCommentEvent(
      'moment-1',
      'commenter-1',
      'mentioned-user-1',
      'Hey @user',
    );

    await listener.handleCommentMention(payload);

    expect(notificationsService.createNotification).toHaveBeenCalled();
  });
});
