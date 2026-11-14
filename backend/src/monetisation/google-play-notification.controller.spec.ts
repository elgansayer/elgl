import { GooglePlayNotificationController } from './google-play-notification.controller';
import { GooglePlayNotificationService } from './google-play-notification.service';

describe('GooglePlayNotificationController', () => {
  const logger = { info: vi.fn() };
  const service = {
    handleNotification: vi.fn().mockResolvedValue({ accepted: true }),
  };
  const controller = new GooglePlayNotificationController(
    logger as never,
    service as unknown as GooglePlayNotificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the payload and authorization header exactly once', async () => {
    const payload = { message: { data: 'base64' } };

    await expect(
      controller.handleNotification(payload, 'Bearer token'),
    ).resolves.toEqual({ accepted: true });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(service.handleNotification).toHaveBeenCalledWith(
      payload,
      'Bearer token',
    );
  });

  it('passes an absent authorization header through for the service to reject', async () => {
    await controller.handleNotification({ message: { data: 'x' } }, undefined);

    expect(service.handleNotification).toHaveBeenCalledWith(
      { message: { data: 'x' } },
      undefined,
    );
  });
});
