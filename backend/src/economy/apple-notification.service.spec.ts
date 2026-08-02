import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AppleNotificationService } from './apple-notification.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EconomyService } from './economy.service';

type MockBuilder = {
  upsert: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  select: jest.Mock;
  single: jest.Mock;
  then: jest.Mock;
};

type MockClient = {
  from: jest.Mock;
};

function createMockSupabase(): { client: MockClient; builder: MockBuilder } {
  const builder = {
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn((onFulfilled: (value: { error: null }) => void) => {
      onFulfilled({ error: null });
    }),
  };

  const client = {
    from: jest.fn().mockReturnValue(builder),
  };

  return { client, builder };
}

describe('AppleNotificationService', () => {
  let service: AppleNotificationService;
  let supabaseClient: MockClient;
  let builder: MockBuilder;

  const configServiceMock = { get: jest.fn() } as unknown as ConfigService;
  const httpServiceMock = {} as unknown as HttpService;
  const supabaseServiceMock = {
    getClient: jest.fn(),
  } as unknown as SupabaseService;
  const economyServiceMock = {} as unknown as EconomyService;

  beforeEach(() => {
    const mock = createMockSupabase();
    supabaseClient = mock.client;
    builder = mock.builder;

    (supabaseServiceMock.getClient as jest.Mock).mockReturnValue(
      supabaseClient,
    );
    (configServiceMock.get as jest.Mock).mockReturnValue('test');

    service = new AppleNotificationService(
      configServiceMock,
      httpServiceMock,
      supabaseServiceMock,
      economyServiceMock,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  const encodePayload = (payload: Record<string, unknown>): string => {
    const json = JSON.stringify(payload);
    return `header.${Buffer.from(json).toString('base64url')}.signature`;
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log a warning when the JWS payload is malformed', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    service.handleNotification('not-a-valid-jws');

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
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
