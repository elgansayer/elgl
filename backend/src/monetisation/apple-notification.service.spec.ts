import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AppleNotificationService } from './apple-notification.service';
import { MonetisationService } from './monetisation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

function base64url(input: object | string): string {
  const json = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(json).toString('base64url');
}

function buildSignedTransactionInfo(payload: Record<string, unknown>): string {
  const header = base64url({ alg: 'ES256' });
  const body = base64url(payload);
  return `${header}.${body}.fake-signature`;
}

function buildSignedPayload(
  notificationType: string,
  subtype: string | undefined,
  transactionInfo: Record<string, unknown> | null,
): string {
  const header = base64url({ alg: 'ES256', x5c: ['leaf-cert', 'root-cert'] });
  const payload: Record<string, unknown> = { notificationType };
  if (subtype) payload.subtype = subtype;
  if (transactionInfo) {
    payload.data = {
      signedTransactionInfo: buildSignedTransactionInfo(transactionInfo),
    };
  }
  const body = base64url(payload);
  return `${header}.${body}.fake-signature`;
}

describe('AppleNotificationService', () => {
  let service: AppleNotificationService;
  let mockSupabaseClient: { from: Mock };
  let mockQueryBuilder: { upsert: Mock };
  let monetisationService: { updateVipStatusFromWebhook: Mock };

  const transactionInfo: {
    originalTransactionId: string;
    productId: string;
    appAccountToken: string;
    transactionId: string;
    expiresDate: number;
    purchaseDate: number;
  } = {
    originalTransactionId: 'orig-txn-1',
    productId: 'com.hellotalk.consumer.monthly',
    appAccountToken: 'user-1',
    transactionId: 'txn-1',
    expiresDate: 1893456000000,
    purchaseDate: 1861920000000,
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };
    monetisationService = {
      updateVipStatusFromWebhook: vi.fn().mockResolvedValue(undefined),
    };

    const subscriptionPlansService = {
      getTierByProductId: vi.fn((productId: string) => {
        if (productId.includes('developer')) {
          return 'developer_20_ukp_26_usd';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppleNotificationService,
        {
          provide: 'PinoLogger:AppleNotificationService',
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          } satisfies Partial<Record<keyof PinoLogger, Mock>>,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(''),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: SubscriptionPlansService,
          useValue: subscriptionPlansService,
        },
        {
          provide: MonetisationService,
          useValue: monetisationService,
        },
      ],
    }).compile();

    service = module.get<AppleNotificationService>(AppleNotificationService);

    // Certificate-chain verification is exercised separately; here we trust
    // a stubbed signature check so tests focus on notification routing.
    vi.spyOn(service as any, 'verifySignature').mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return "ignored" when the payload has no signedPayload', async () => {
    const result = await service.handleNotification({});
    expect(result).toEqual({ received: true, status: 'ignored' });
    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
  });

  it('should return "error" (not throw) when the JWS signature is invalid, so Apple does not retry forever', async () => {
    vi.spyOn(service as any, 'verifySignature').mockReturnValue(false);
    const signedPayload = buildSignedPayload(
      'SUBSCRIBED',
      undefined,
      transactionInfo,
    );

    const result = await service.handleNotification({ signedPayload });

    expect(result).toEqual({ received: true, status: 'error' });
    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
  });

  it.each(['SUBSCRIBED', 'DID_RENEW', 'RENEWAL'])(
    'should activate VIP status for %s notifications using appAccountToken as the user id',
    async (notificationType) => {
      const signedPayload = buildSignedPayload(
        notificationType,
        undefined,
        transactionInfo,
      );

      const result = await service.handleNotification({ signedPayload });

      expect(
        monetisationService.updateVipStatusFromWebhook,
      ).toHaveBeenCalledWith('user-1', true, 'consumer_8_ukp_10_usd');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'apple_subscriptions',
      );
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          original_transaction_id: 'orig-txn-1',
          transaction_id: 'txn-1',
          product_id: 'com.hellotalk.consumer.monthly',
          status: 'active',
        }),
        { onConflict: 'original_transaction_id', ignoreDuplicates: false },
      );
      expect(result).toEqual({ received: true, status: 'processed' });
    },
  );

  it('should map developer product ids to the developer tier', async () => {
    const signedPayload = buildSignedPayload('SUBSCRIBED', undefined, {
      ...transactionInfo,
      productId: 'com.hellotalk.developer.monthly',
    });

    await service.handleNotification({ signedPayload });

    expect(monetisationService.updateVipStatusFromWebhook).toHaveBeenCalledWith(
      'user-1',
      true,
      'developer_20_ukp_26_usd',
    );
  });

  it.each(['EXPIRED', 'CANCEL', 'REFUND', 'REVOKE'])(
    'should revoke VIP status for %s notifications',
    async (notificationType) => {
      const signedPayload = buildSignedPayload(
        notificationType,
        undefined,
        transactionInfo,
      );

      const result = await service.handleNotification({ signedPayload });

      expect(
        monetisationService.updateVipStatusFromWebhook,
      ).toHaveBeenCalledWith('user-1', false, null);
      expect(result).toEqual({ received: true, status: 'processed' });
    },
  );

  it('should revoke VIP status when the user disables auto-renew', async () => {
    const signedPayload = buildSignedPayload(
      'DID_CHANGE_RENEWAL_STATUS',
      'AUTO_RENEW_DISABLED',
      transactionInfo,
    );

    await service.handleNotification({ signedPayload });

    expect(monetisationService.updateVipStatusFromWebhook).toHaveBeenCalledWith(
      'user-1',
      false,
      null,
    );
  });

  it('should keep VIP status active when auto-renew is re-enabled', async () => {
    const signedPayload = buildSignedPayload(
      'DID_CHANGE_RENEWAL_STATUS',
      'AUTO_RENEW_ENABLED',
      transactionInfo,
    );

    await service.handleNotification({ signedPayload });

    expect(monetisationService.updateVipStatusFromWebhook).toHaveBeenCalledWith(
      'user-1',
      true,
      'consumer_8_ukp_10_usd',
    );
  });

  it('should not update VIP status when the transaction has no appAccountToken', async () => {
    const signedPayload = buildSignedPayload('SUBSCRIBED', undefined, {
      ...transactionInfo,
      appAccountToken: undefined,
    });

    const result = await service.handleNotification({ signedPayload });

    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true, status: 'processed' });
  });

  it('should acknowledge unhandled notification types without mutating VIP status', async () => {
    const signedPayload = buildSignedPayload(
      'TEST',
      undefined,
      transactionInfo,
    );

    const result = await service.handleNotification({ signedPayload });

    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true, status: 'processed' });
  });
});
