import { ProfileViewEvent } from '../events/notification.events';
import { ProfileViewNotificationListener } from './profile-view-notification.listener';

describe('ProfileViewNotificationListener', () => {
  const recipientId = 'owner-1';
  const viewerId = 'viewer-1';
  let createNotification: ReturnType<typeof vi.fn>;
  let sendPushNotification: ReturnType<typeof vi.fn>;
  let shouldSendNotification: ReturnType<typeof vi.fn>;
  let listener: ProfileViewNotificationListener;

  beforeEach(() => {
    createNotification = vi.fn().mockResolvedValue(undefined);
    sendPushNotification = vi.fn().mockResolvedValue(true);
    shouldSendNotification = vi.fn().mockResolvedValue(true);
    listener = new ProfileViewNotificationListener(
      { createNotification, sendPushNotification } as never,
      { shouldSendNotification } as never,
    );
  });

  it('stores a VIP inbox notification without dispatching a duplicate push', async () => {
    await listener.handleProfileVisit(
      new ProfileViewEvent(viewerId, recipientId, true),
    );

    expect(createNotification).toHaveBeenCalledWith(
      recipientId,
      viewerId,
      'profile_visit',
      undefined,
      undefined,
      false,
    );
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).toHaveBeenCalledWith(
      recipientId,
      expect.objectContaining({
        type: 'profile_visit',
        body: 'Someone viewed your profile',
        data: {},
      }),
    );
  });

  it('does not persist the viewer identity for a non-VIP owner', async () => {
    await listener.handleProfileVisit(
      new ProfileViewEvent(viewerId, recipientId, false),
    );

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sendPushNotification.mock.calls)).not.toContain(
      viewerId,
    );
  });

  it('respects a disabled push preference while retaining the VIP inbox item', async () => {
    shouldSendNotification
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await listener.handleProfileVisit(
      new ProfileViewEvent(viewerId, recipientId, true),
    );

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});
