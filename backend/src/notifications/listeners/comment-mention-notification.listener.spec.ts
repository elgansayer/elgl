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

  it('creates a notification for a mentioned user', async () => {
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

  it('deduplicates recipients, skips self mentions, and caps fan-out', async () => {
    const recipients = [
      'commenter-1',
      'mentioned-user-1',
      'mentioned-user-1',
      ...Array.from(
        { length: 25 },
        (_, index) => `mentioned-user-${index + 2}`,
      ),
    ];

    await listener.handleCommentMention(
      new MomentCommentEvent(
        'moment-1',
        'commenter-1',
        'moment-author-1',
        'hello',
        undefined,
        undefined,
        recipients,
      ),
    );

    expect(
      notificationPreferencesService.shouldSendNotification,
    ).toHaveBeenCalledTimes(20);
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(20);
    expect(notificationsService.createNotification).not.toHaveBeenCalledWith(
      'commenter-1',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('falls back to momentAuthorId for backward compatibility', async () => {
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

  it('skips notification when preferences disable push', async () => {
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

  it('fails closed when notification preferences cannot be loaded', async () => {
    vi.spyOn(
      notificationPreferencesService,
      'shouldSendNotification',
    ).mockRejectedValue(new Error('DB error'));
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

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
    expect(warnSpy).toHaveBeenCalledWith(
      'Moment mention preference lookup failed; notification suppressed.',
    );
    warnSpy.mockRestore();
  });

  it('isolates delivery failures so later recipients are still processed', async () => {
    vi.spyOn(notificationsService, 'createNotification')
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce(undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await listener.handleCommentMention(
      new MomentCommentEvent(
        'moment-1',
        'commenter-1',
        'moment-author-1',
        'hello',
        undefined,
        undefined,
        ['mentioned-user-1', 'mentioned-user-2'],
      ),
    );

    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.createNotification).toHaveBeenLastCalledWith(
      'mentioned-user-2',
      'commenter-1',
      'mention_comment',
      'moment-1',
      'hello',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Moment mention notification delivery failed.',
    );
    warnSpy.mockRestore();
  });

  it('skips self mention', async () => {
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
