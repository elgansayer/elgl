import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { of } from 'rxjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { MonetisationService } from './monetisation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

const AUDIENCE = 'https://api.hellotalk.app/monetisation/webhooks/google';
const SERVICE_ACCOUNT_EMAIL =
  'pubsub-push@hellotalk-project.iam.gserviceaccount.com';
const TEST_KID = 'test-key-1';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function buildPubSubPayload(data: Record<string, unknown>) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(data)).toString('base64'),
      messageId: 'msg-1',
    },
    subscription: 'projects/hellotalk/subscriptions/rtdn',
  };
}

function signGoogleOidcToken(
  overrides: Record<string, unknown> = {},
  signOptions: Partial<jwt.SignOptions> = {},
): string {
  return jwt.sign(
    {
      email: SERVICE_ACCOUNT_EMAIL,
      email_verified: true,
      ...overrides,
    },
    privateKey,
    {
      algorithm: 'RS256',
      audience: AUDIENCE,
      issuer: 'https://accounts.google.com',
      expiresIn: '5m',
      keyid: TEST_KID,
      ...signOptions,
    },
  );
}

function validAuthHeader(
  overrides: Record<string, unknown> = {},
  signOptions: Partial<jwt.SignOptions> = {},
): string {
  return `Bearer ${signGoogleOidcToken(overrides, signOptions)}`;
}

describe('GooglePlayNotificationService', () => {
  let service: GooglePlayNotificationService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let monetisationService: { updateVipStatusFromWebhook: Mock };
  let httpService: { get: Mock };
  let subscriptionPlansService: { getTierByProductId: Mock };

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };
    monetisationService = {
      updateVipStatusFromWebhook: vi.fn().mockResolvedValue(undefined),
    };
    httpService = { get: vi.fn() };
    subscriptionPlansService = {
      getTierByProductId: vi.fn((productId: string) => productId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'PinoLogger:GooglePlayNotificationService',
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
        GooglePlayNotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'GOOGLE_PLAY_PACKAGE_NAME')
                return 'com.hellotalk.app';
              if (key === 'GOOGLE_PLAY_ACCESS_TOKEN') return 'access-token';
              if (key === 'GOOGLE_PUBSUB_AUDIENCE') return AUDIENCE;
              if (key === 'GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL')
                return SERVICE_ACCOUNT_EMAIL;
              if (key === 'GOOGLE_JWKS_URI')
                return 'https://www.googleapis.com/oauth2/v3/certs';
              return undefined;
            }),
          },
        },
        { provide: HttpService, useValue: httpService },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        { provide: MonetisationService, useValue: monetisationService },
        {
          provide: SubscriptionPlansService,
          useValue: subscriptionPlansService,
        },
      ],
    }).compile();

    service = module.get<GooglePlayNotificationService>(
      GooglePlayNotificationService,
    );

    // Stand in for the real Google JWKS endpoint - hand back the test key
    // pair instead of hitting the network.
    (service as any).jwksClient = {
      getSigningKey: vi.fn().mockResolvedValue({
        getPublicKey: () => publicKey,
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockActiveSubscription(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    httpService.get.mockReturnValue(
      of({
        data: {
          startTimeMillis: '1700000000000',
          expiryTimeMillis: String(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenewing: true,
          acknowledgementState: 1,
          kind: 'androidpublisher#subscriptionPurchase',
          orderId: 'order-1',
          purchaseState: 0,
          ...overrides,
        },
      }),
    );
  }

  function mockExpiredSubscription(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    httpService.get.mockReturnValue(
      of({
        data: {
          startTimeMillis: '1600000000000',
          expiryTimeMillis: String(Date.now() - 24 * 60 * 60 * 1000),
          autoRenewing: false,
          acknowledgementState: 1,
          kind: 'androidpublisher#subscriptionPurchase',
          orderId: 'order-1',
          purchaseState: 0,
          ...overrides,
        },
      }),
    );
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Pub/Sub OIDC authentication', () => {
    it('should reject requests with no Authorization header', async () => {
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(service.handleNotification(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(
        monetisationService.updateVipStatusFromWebhook,
      ).not.toHaveBeenCalled();
    });

    it('should reject requests with a malformed Authorization header', async () => {
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(
        service.handleNotification(payload, 'not-a-bearer-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token signed with the wrong key (bad signature)', async () => {
      const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const forgedToken = jwt.sign(
        { email: SERVICE_ACCOUNT_EMAIL, email_verified: true },
        otherKey,
        {
          algorithm: 'RS256',
          audience: AUDIENCE,
          issuer: 'https://accounts.google.com',
          expiresIn: '5m',
          keyid: TEST_KID,
        },
      );
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(
        service.handleNotification(payload, `Bearer ${forgedToken}`),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token with the wrong audience', async () => {
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(
        service.handleNotification(
          payload,
          validAuthHeader({}, { audience: 'https://attacker.example/webhook' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token with the wrong issuer', async () => {
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(
        service.handleNotification(
          payload,
          validAuthHeader({}, { issuer: 'https://not-google.example' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a validly-signed token from an unexpected service account', async () => {
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(
        service.handleNotification(
          payload,
          validAuthHeader({ email: 'someone-else@example.com' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when GOOGLE_PUBSUB_AUDIENCE/SERVICE_ACCOUNT_EMAIL are not configured (fail closed)', async () => {
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'GOOGLE_PLAY_PACKAGE_NAME') return 'com.hellotalk.app';
          if (key === 'GOOGLE_PLAY_ACCESS_TOKEN') return 'access-token';
          return undefined;
        }),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: 'PinoLogger:GooglePlayNotificationService',
            useValue: {
              info: vi.fn(),
              warn: vi.fn(),
              error: vi.fn(),
              debug: vi.fn(),
            },
          },
          GooglePlayNotificationService,
          { provide: ConfigService, useValue: configService },
          { provide: HttpService, useValue: httpService },
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
          { provide: MonetisationService, useValue: monetisationService },
        ],
      }).compile();
      const unconfiguredService = module.get<GooglePlayNotificationService>(
        GooglePlayNotificationService,
      );
      const payload = buildPubSubPayload({
        testNotification: { version: '1.0' },
      });

      await expect(
        unconfiguredService.handleNotification(payload, validAuthHeader()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should accept a correctly-signed token for the configured service account', async () => {
      const payload = buildPubSubPayload({
        version: '1.0',
        packageName: 'com.hellotalk.app',
        eventTimeMillis: '1700000000000',
        testNotification: { version: '1.0' },
      });

      const result = await service.handleNotification(
        payload,
        validAuthHeader(),
      );

      expect(result).toEqual({ received: true, status: 'processed' });
    });
  });

  it('should acknowledge a test notification without touching VIP status', async () => {
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      testNotification: { version: '1.0' },
    });

    const result = await service.handleNotification(payload, validAuthHeader());

    expect(result).toEqual({ received: true, status: 'processed' });
    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
  });

  it('should return "ignored" when the pub/sub envelope has no message', async () => {
    const result = await service.handleNotification({}, validAuthHeader());
    expect(result).toEqual({ received: true, status: 'ignored' });
  });

  it('should activate VIP status when a known purchase token renews and Google Play confirms it is still active (notificationType 3 = RENEWED)', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: { user_id: 'user-1' },
    });
    mockActiveSubscription();
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 3,
        purchaseToken: 'token-1',
        subscriptionId: 'consumer_8_ukp_10_usd',
      },
    });

    const result = await service.handleNotification(payload, validAuthHeader());

    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining(
        '/applications/com.hellotalk.app/purchases/subscriptions/consumer_8_ukp_10_usd/tokens/token-1',
      ),
      { headers: { Authorization: 'Bearer access-token' } },
    );
    expect(mockSupabaseClient.from).toHaveBeenCalledWith(
      'google_play_purchases',
    );
    expect(monetisationService.updateVipStatusFromWebhook).toHaveBeenCalledWith(
      'user-1',
      true,
      'consumer_8_ukp_10_usd',
    );
    expect(result).toEqual({ received: true, status: 'processed' });
  });

  it('should NOT grant VIP for a known purchase token if Google Play Developer API says the entitlement has already expired (forged/replayed RENEWED notification)', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: { user_id: 'user-1' },
    });
    mockExpiredSubscription();
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 3,
        purchaseToken: 'token-1',
        subscriptionId: 'consumer_8_ukp_10_usd',
      },
    });

    const result = await service.handleNotification(payload, validAuthHeader());

    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({ received: true, status: 'processed' });
  });

  it('should NOT grant VIP for a known purchase token when the Google Play Developer API cannot be reached to confirm it', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: { user_id: 'user-1' },
    });
    httpService.get.mockImplementation(() => {
      throw new Error('network error');
    });
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 3,
        purchaseToken: 'token-1',
        subscriptionId: 'consumer_8_ukp_10_usd',
      },
    });

    await service.handleNotification(payload, validAuthHeader());

    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
  });

  it('should look up the purchase on the Google Play API and store it when the token is not yet known locally', async () => {
    mockQueryBuilder.single.mockResolvedValue({ data: null });
    mockActiveSubscription({ obfuscatedExternalAccountId: 'user-2' });
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 1,
        purchaseToken: 'token-2',
        subscriptionId: 'developer_20_ukp_26_usd',
      },
    });

    await service.handleNotification(payload, validAuthHeader());

    expect(httpService.get).toHaveBeenCalledWith(
      expect.stringContaining(
        '/applications/com.hellotalk.app/purchases/subscriptions/developer_20_ukp_26_usd/tokens/token-2',
      ),
      { headers: { Authorization: 'Bearer access-token' } },
    );
    expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-2',
        purchase_token: 'token-2',
        subscription_id: 'developer_20_ukp_26_usd',
        status: 'active',
      },
      { onConflict: 'purchase_token', ignoreDuplicates: false },
    );
    expect(monetisationService.updateVipStatusFromWebhook).toHaveBeenCalledWith(
      'user-2',
      true,
      'developer_20_ukp_26_usd',
    );
  });

  it('should revoke VIP status when a known purchase token expires (notificationType 5 = EXPIRED)', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: { user_id: 'user-1' },
    });
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 5,
        purchaseToken: 'token-1',
        subscriptionId: 'consumer_8_ukp_10_usd',
      },
    });

    const result = await service.handleNotification(payload, validAuthHeader());

    expect(monetisationService.updateVipStatusFromWebhook).toHaveBeenCalledWith(
      'user-1',
      false,
      null,
    );
    expect(result).toEqual({ received: true, status: 'processed' });
  });

  it('should not revoke VIP status when the purchase token cannot be resolved to a user', async () => {
    mockQueryBuilder.single.mockResolvedValue({ data: null });
    const payload = buildPubSubPayload({
      version: '1.0',
      packageName: 'com.hellotalk.app',
      eventTimeMillis: '1700000000000',
      subscriptionNotification: {
        version: '1.0',
        notificationType: 5,
        purchaseToken: 'unknown-token',
        subscriptionId: 'consumer_8_ukp_10_usd',
      },
    });

    await service.handleNotification(payload, validAuthHeader());

    expect(
      monetisationService.updateVipStatusFromWebhook,
    ).not.toHaveBeenCalled();
  });

  it('should return "error" (not throw) when the payload cannot be parsed, so Google does not retry forever', async () => {
    const payload = {
      message: { data: Buffer.from('not-json').toString('base64') },
    };

    const result = await service.handleNotification(payload, validAuthHeader());

    expect(result).toEqual({ received: true, status: 'error' });
  });
});
