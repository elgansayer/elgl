import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  LikeEvent,
  MomentCommentEvent,
  SystemAlertEvent,
} from './events/notification.events';
import { CommentNotificationListener } from './listeners/comment-notification.listener';
import { LikeNotificationListener } from './listeners/like-notification.listener';
import { SystemNotificationListener } from './listeners/system-notification.listener';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';

/**
 * Producers and listeners are connected only by event-name strings, so a typo
 * on either side silently drops notifications (the comment listener once
 * subscribed to `comment.moment` while MomentsService emitted
 * `moment.comment`). These tests emit the exact names the producers use
 * through a real EventEmitter2 and assert the inbox rows are requested.
 *
 * The producer side is pinned by the MomentsService specs, which assert the
 * same literals for `moment.comment` and `user.liked`.
 */
describe('notification event wiring', () => {
  let moduleRef: TestingModule;
  let emitter: EventEmitter2;
  const notificationsService = {
    createNotification: vi.fn(),
    hasNotification: vi.fn(),
    sendPushNotification: vi.fn(),
  };
  const preferences = { shouldSendNotification: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    notificationsService.createNotification.mockResolvedValue(undefined);
    notificationsService.hasNotification.mockResolvedValue(false);
    notificationsService.sendPushNotification.mockResolvedValue('sent');
    preferences.shouldSendNotification.mockResolvedValue(true);

    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        CommentNotificationListener,
        LikeNotificationListener,
        SystemNotificationListener,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: NotificationPreferencesService, useValue: preferences },
      ],
    }).compile();
    await moduleRef.init();
    emitter = moduleRef.get(EventEmitter2);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('delivers moment.comment to the comment inbox listener', async () => {
    await emitter.emitAsync(
      'moment.comment',
      new MomentCommentEvent('moment-1', 'commenter-1', 'author-1', 'Nice!'),
    );

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'author-1',
      'commenter-1',
      'comment_moment',
      'moment-1',
      'Nice!',
      false,
    );
  });

  it('delivers user.liked to the like inbox listener', async () => {
    await emitter.emitAsync(
      'user.liked',
      new LikeEvent('liker-1', 'author-1', 'moment', 'moment-1'),
    );

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'author-1',
      'liker-1',
      'like_moment',
      'moment-1',
      undefined,
      false,
    );
  });

  it('delivers system.alert to the system inbox listener', async () => {
    await emitter.emitAsync(
      'system.alert',
      new SystemAlertEvent('user-1', 'Your plan was updated'),
    );

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      'system',
      undefined,
      'Your plan was updated',
    );
  });
});
