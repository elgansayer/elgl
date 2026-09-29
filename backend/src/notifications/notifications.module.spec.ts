import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsModule } from './notifications.module';

describe('NotificationsModule', () => {
  it('registers the notifications and preferences controllers exactly once', () => {
    const controllers =
      (Reflect.getMetadata('controllers', NotificationsModule) as unknown[]) ??
      [];

    expect(controllers).toContain(NotificationsController);
    expect(controllers).toContain(NotificationPreferencesController);
    expect(
      controllers.filter(
        (controller) => controller === NotificationPreferencesController,
      ),
    ).toHaveLength(1);
  });
});
