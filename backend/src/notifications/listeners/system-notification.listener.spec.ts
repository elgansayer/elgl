import { SystemAlertEvent } from '../events/notification.events';
import {
  MAX_SYSTEM_ALERT_LENGTH,
  SystemNotificationListener,
} from './system-notification.listener';

const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('SystemNotificationListener', () => {
  let createNotification: ReturnType<typeof vi.fn>;
  let listener: SystemNotificationListener;

  beforeEach(() => {
    createNotification = vi.fn().mockResolvedValue(undefined);
    listener = new SystemNotificationListener({ createNotification } as never);
  });

  it('stores a system alert against the recipient without a human actor', async () => {
    await listener.handleSystemAlert(
      new SystemAlertEvent('user-1', 'Your plan was updated', 'entity-1'),
    );

    expect(createNotification).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      'system',
      'entity-1',
      'Your plan was updated',
    );
  });

  it('trims and bounds the message before persisting it', async () => {
    await listener.handleSystemAlert(
      new SystemAlertEvent(
        'user-1',
        `  ${'a'.repeat(MAX_SYSTEM_ALERT_LENGTH + 50)}  `,
      ),
    );

    const [, , , , message] = createNotification.mock.calls[0] as string[];
    expect(message).toHaveLength(MAX_SYSTEM_ALERT_LENGTH);
  });

  it('never splits an emoji at the length limit', async () => {
    const message = `${'a'.repeat(MAX_SYSTEM_ALERT_LENGTH - 1)}😀${'b'.repeat(20)}`;

    await listener.handleSystemAlert(new SystemAlertEvent('user-1', message));

    const [, , , , stored] = createNotification.mock.calls[0] as string[];
    expect(Array.from(stored)).toHaveLength(MAX_SYSTEM_ALERT_LENGTH);
    expect(stored.endsWith('😀')).toBe(true);
    expect(stored).not.toMatch(LONE_SURROGATE);
  });

  it.each([
    ['a blank message', new SystemAlertEvent('user-1', '   ')],
    ['a missing recipient', new SystemAlertEvent('', 'Hello')],
  ])(
    'rejects %s instead of persisting an empty inbox row',
    async (_label, event) => {
      await listener.handleSystemAlert(event);

      expect(createNotification).not.toHaveBeenCalled();
    },
  );
});
