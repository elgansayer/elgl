import { AppleNotificationController } from './apple-notification.controller';
import { AppleNotificationService } from './apple-notification.service';

describe('AppleNotificationController', () => {
  const logger = { info: vi.fn() };
  const service = {
    handleNotification: vi.fn().mockResolvedValue({ accepted: true }),
  };
  const controller = new AppleNotificationController(
    logger as never,
    service as unknown as AppleNotificationService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates the signed payload to the notification service', async () => {
    const payload = { signedPayload: 'jws-token' };

    await expect(controller.handleNotification(payload)).resolves.toEqual({
      accepted: true,
    });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(service.handleNotification).toHaveBeenCalledWith(payload);
  });

  it('propagates verification failures instead of acknowledging them', async () => {
    service.handleNotification.mockRejectedValue(
      new Error('invalid signature'),
    );

    await expect(
      controller.handleNotification({ signedPayload: 'forged' }),
    ).rejects.toThrow('invalid signature');
  });
});
