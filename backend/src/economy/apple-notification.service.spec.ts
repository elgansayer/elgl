import type { Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PinoLogger } from 'nestjs-pino';
import { AppleNotificationService } from './apple-notification.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EconomyService } from './economy.service';

type MockBuilder = {
  upsert: Mock;
  update: Mock;
  eq: Mock;
  select: Mock;
  single: Mock;
  then: Mock;
};

type MockClient = {
  from: Mock;
};

function createMockSupabase(): { client: MockClient; builder: MockBuilder } {
  const builder = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((onFulfilled: (value: { error: null }) => void) => {
      onFulfilled({ error: null });
    }),
  };

  const client = {
    from: vi.fn().mockReturnValue(builder),
  };

  return { client, builder };
}

describe('AppleNotificationService', () => {
  let service: AppleNotificationService;
  let supabaseClient: MockClient;
  let builder: MockBuilder;
  let pinoLoggerMock: Record<'info' | 'error' | 'warn' | 'debug', Mock>;

  const configServiceMock = { get: vi.fn() } as unknown as ConfigService;
  const httpServiceMock = {} as unknown as HttpService;
  const supabaseServiceMock = {
    getClient: vi.fn(),
  } as unknown as SupabaseService;
  const economyServiceMock = {} as unknown as EconomyService;

  beforeEach(() => {
    const mock = createMockSupabase();
    supabaseClient = mock.client;
    builder = mock.builder;

    (supabaseServiceMock.getClient as Mock).mockReturnValue(supabaseClient);
    (configServiceMock.get as Mock).mockReturnValue('test');

    pinoLoggerMock = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    service = new AppleNotificationService(
      pinoLoggerMock as unknown as PinoLogger,
      configServiceMock,
      httpServiceMock,
      supabaseServiceMock,
      economyServiceMock,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  const encodePayload = (payload: Record<string, unknown>): string => {
    const json = JSON.stringify(payload);
    return `header.${Buffer.from(json).toString('base64url')}.signature`;
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log a warning when the JWS payload is malformed', () => {
    service.handleNotification('not-a-valid-jws');

    expect(pinoLoggerMock.warn).toHaveBeenCalled();
  });

  it('should handle a SUBSCRIBED notification and upsert the subscription', () => {
    const payload = {
      notificationType: 'SUBSCRIBED',
      data: {
        appAccountToken: 'user-123',
        signedTransactionInfo: {
          productId: 'com.example.vip',
          transactionId: 'txn-abc',
        },
      },
    };

    service.handleNotification(encodePayload(payload));

    expect(supabaseClient.from).toHaveBeenCalledWith('subscriptions');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        product_id: 'com.example.vip',
        status: 'active',
        transaction_id: 'txn-abc',
      }),
      { onConflict: 'user_id' },
    );
  });

  it('should handle an EXPIRED notification and mark the subscription as expired', () => {
    const payload = {
      notificationType: 'EXPIRED',
      data: {
        appAccountToken: 'user-123',
        expirationIntent: 2,
      },
    };

    service.handleNotification(encodePayload(payload));

    expect(supabaseClient.from).toHaveBeenCalledWith('subscriptions');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        product_id: null,
        status: 'expired',
      }),
      { onConflict: 'user_id' },
    );
  });

  it('should handle a DID_CHANGE_RENEWAL_STATUS notification and update auto-renew', () => {
    const payload = {
      notificationType: 'DID_CHANGE_RENEWAL_STATUS',
      data: {
        appAccountToken: 'user-123',
        autoRenewStatus: 0,
      },
    };

    service.handleNotification(encodePayload(payload));

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        auto_renew: false,
      }),
    );
  });

  it('should handle a RENEWAL_EXTENSION notification and extend the subscription', async () => {
    builder.single.mockResolvedValue({
      data: { expires_at: '2025-01-01T00:00:00.000Z' },
      error: null,
    });

    const payload = {
      notificationType: 'RENEWAL_EXTENSION',
      data: {
        appAccountToken: 'user-123',
        extensionLength: 30,
      },
    };

    service.handleNotification(encodePayload(payload));
    await Promise.resolve(); // allow the async callback to run
    await Promise.resolve();

    expect(supabaseClient.from).toHaveBeenCalledWith('subscriptions');
    expect(builder.select).toHaveBeenCalledWith('expires_at');
    expect(builder.update).toHaveBeenCalled();
  });

  it('should handle a REFUND notification and deduct the appropriate number of coins', async () => {
    builder.single.mockImplementation(() =>
      Promise.resolve({
        data: { coins_added: 10 },
        error: null,
      }),
    );

    const payload = {
      notificationType: 'REFUND',
      data: {
        appAccountToken: 'user-123',
        signedTransactionInfo: {
          transactionId: 'txn-refund-1',
        },
      },
    };

    service.handleNotification(encodePayload(payload));
    await Promise.resolve();
    await Promise.resolve();

    expect(supabaseClient.from).toHaveBeenCalledWith('coin_purchases');
    expect(supabaseClient.from).toHaveBeenCalledWith('users');
  });
});
