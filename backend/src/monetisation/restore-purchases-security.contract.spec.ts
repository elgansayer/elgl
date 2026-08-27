import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MonetisationService } from './monetisation.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';

describe('Restore purchases ownership security', () => {
  let module: TestingModule;
  let service: MonetisationService;
  let vipUpdateSpy: ReturnType<typeof vi.spyOn>;

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const googlePlay = {
    getSubscriptionPurchaseDetails: vi.fn(),
    getUserIdByPurchaseToken: vi.fn(),
    storePurchaseToken: vi.fn(),
  };

  const subscriptionPlans = {
    getTierByProductId: vi.fn(),
  };

  const receipt = (purchaseToken = 'secret-purchase-token') =>
    JSON.stringify({
      purchaseToken,
      productId: 'com.example.vip.monthly',
    });

  beforeEach(async () => {
    vi.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        MonetisationService,
        {
          provide: 'PinoLogger:MonetisationService',
          useValue: logger,
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test';
              if (key === 'NODE_ENV') return 'test';
              return undefined;
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn() },
        },
        {
          provide: AppleNotificationService,
          useValue: {},
        },
        {
          provide: GooglePlayNotificationService,
          useValue: googlePlay,
        },
        {
          provide: SubscriptionPlansService,
          useValue: subscriptionPlans,
        },
        {
          provide: AppleReceiptValidatorService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(MonetisationService);
    vipUpdateSpy = vi
      .spyOn(service, 'updateVipStatusFromWebhook')
      .mockResolvedValue(undefined);

    googlePlay.getSubscriptionPurchaseDetails.mockResolvedValue({
      expiryTimeMillis: String(Date.now() + 60_000),
    });
    googlePlay.storePurchaseToken.mockResolvedValue(undefined);
    subscriptionPlans.getTierByProductId.mockReturnValue('consumer');
  });

  afterEach(async () => {
    await module.close();
  });

  it('rejects an Android purchase token that is already owned by another account', async () => {
    const purchaseToken = 'secret-cross-account-token';
    googlePlay.getUserIdByPurchaseToken.mockResolvedValue('other-user-id');

    await expect(
      service.restorePurchases('current-user-id', 'android', receipt(purchaseToken)),
    ).rejects.toThrow(
      new ForbiddenException('This purchase is already linked to another account'),
    );

    expect(googlePlay.storePurchaseToken).not.toHaveBeenCalled();
    expect(vipUpdateSpy).not.toHaveBeenCalled();

    const warnings = logger.warn.mock.calls.flat().join(' ');
    expect(warnings).toContain(
      'Android restore rejected: purchase belongs to a different account',
    );
    expect(warnings).not.toContain(purchaseToken);
    expect(warnings).not.toContain('other-user-id');
    expect(warnings).not.toContain('current-user-id');
  });

  it('claims an unowned Android purchase before restoring entitlement', async () => {
    googlePlay.getUserIdByPurchaseToken.mockResolvedValue(null);

    await expect(
      service.restorePurchases('current-user-id', 'android', receipt()),
    ).resolves.toEqual({ received: true, status: 'restored' });

    expect(googlePlay.storePurchaseToken).toHaveBeenCalledWith(
      'current-user-id',
      'secret-purchase-token',
      'com.example.vip.monthly',
    );
    expect(vipUpdateSpy).toHaveBeenCalledWith(
      'current-user-id',
      true,
      'consumer',
    );
  });

  it('restores a purchase already owned by the authenticated account without re-storing it', async () => {
    googlePlay.getUserIdByPurchaseToken.mockResolvedValue('current-user-id');

    await expect(
      service.restorePurchases('current-user-id', 'android', receipt()),
    ).resolves.toEqual({ received: true, status: 'restored' });

    expect(googlePlay.storePurchaseToken).not.toHaveBeenCalled();
    expect(vipUpdateSpy).toHaveBeenCalledWith(
      'current-user-id',
      true,
      'consumer',
    );
  });

  it('does not log purchase tokens when Google Play has no matching purchase', async () => {
    const purchaseToken = 'secret-missing-purchase-token';
    googlePlay.getSubscriptionPurchaseDetails.mockResolvedValue(null);

    await expect(
      service.restorePurchases('current-user-id', 'android', receipt(purchaseToken)),
    ).resolves.toEqual({
      received: true,
      status: 'no_valid_subscription',
    });

    const warnings = logger.warn.mock.calls.flat().join(' ');
    expect(warnings).toContain('Android restore: purchase details unavailable');
    expect(warnings).not.toContain(purchaseToken);
    expect(vipUpdateSpy).not.toHaveBeenCalled();
  });

  it('does not log purchase tokens when the Google Play entitlement is expired', async () => {
    const purchaseToken = 'secret-expired-purchase-token';
    googlePlay.getSubscriptionPurchaseDetails.mockResolvedValue({
      expiryTimeMillis: String(Date.now() - 60_000),
    });

    await expect(
      service.restorePurchases('current-user-id', 'android', receipt(purchaseToken)),
    ).resolves.toEqual({
      received: true,
      status: 'no_valid_subscription',
    });

    const warnings = logger.warn.mock.calls.flat().join(' ');
    expect(warnings).toContain('Android restore: purchase not currently entitled');
    expect(warnings).not.toContain(purchaseToken);
    expect(vipUpdateSpy).not.toHaveBeenCalled();
  });
});
