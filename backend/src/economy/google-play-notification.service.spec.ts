vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn(),
          createDocumentFragment: vi.fn(),
        },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
      },
    };
  }),
}));

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: vi.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SupabaseService } from '../supabase/supabase.service';
import { EconomyService } from './economy.service';

function createPubSubMessage(
  notificationData: Record<string, unknown>,
): Record<string, unknown> {
  const dataString = JSON.stringify(notificationData);
  const base64Data = Buffer.from(dataString).toString('base64');
  return {
    message: {
      data: base64Data,
      messageId: 'msg-123',
      publishTime: new Date().toISOString(),
    },
  };
}

describe('GooglePlayNotificationService', () => {
  let service: GooglePlayNotificationService;
  let mockSupabaseClient: any;
  let module: TestingModule;

  function createQueryBuilder(overrides: Record<string, any> = {}) {
    return {
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { user_id: 'user-1' },
        error: null,
      }),
      then: vi.fn(function (this: any, resolve: any) {
        return resolve({ error: null, data: null });
      }),
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockSupabaseClient = createQueryBuilder();
    mockSupabaseClient.from = vi.fn().mockImplementation((_table: string) => {
      return createQueryBuilder();
    });

    module = await Test.createTestingModule({
      providers: [
        GooglePlayNotificationService,
        {
          provide: 'PinoLogger:GooglePlayNotificationService',
          useValue: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(null) },
        },
        {
          provide: HttpService,
          useValue: { get: vi.fn(), post: vi.fn() },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: EconomyService,
          useValue: {
            getBalance: vi.fn(),
            purchaseCoins: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GooglePlayNotificationService>(
      GooglePlayNotificationService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleNotification', () => {
    it('should warn and return when message data is missing', () => {
      const warnSpy = vi.spyOn(service['logger'], 'warn');

      service.handleNotification({});

      expect(warnSpy).toHaveBeenCalledWith(
        'Google Play notification missing data',
      );
    });

    it('should warn and return when subscriptionNotification is missing', () => {
      const warnSpy = vi.spyOn(service['logger'], 'warn');
      const msg = createPubSubMessage({
        packageName: 'com.example',
      });

      service.handleNotification(msg);

      expect(warnSpy).toHaveBeenCalledWith(
        'Google Play notification missing subscriptionNotification',
      );
    });

    it('should handle SUBSCRIPTION_RECOVERED (type 1)', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-1' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 1,
          purchaseToken: 'token_abc',
          subscriptionId: 'sub_monthly',
        },
      });

      service.handleNotification(msg);

      // Let async operations settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should handle SUBSCRIPTION_RENEWED (type 2)', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-2' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 2,
          purchaseToken: 'token_xyz',
          subscriptionId: 'sub_yearly',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should handle SUBSCRIPTION_CANCELED (type 3)', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-3' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 3,
          purchaseToken: 'token_cancel',
          subscriptionId: 'sub_monthly',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should handle SUBSCRIPTION_PURCHASED (type 4)', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-new' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 4,
          purchaseToken: 'token_new',
          subscriptionId: 'sub_monthly',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should handle SUBSCRIPTION_ON_HOLD (type 5)', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-hold' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 5,
          purchaseToken: 'token_hold',
          subscriptionId: 'sub_monthly',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('should handle SUBSCRIPTION_REVOKED (type 12) and revoke VIP benefits', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-bad' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 12,
          purchaseToken: 'token_revoke',
          subscriptionId: 'sub_year',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify revokeSubscriptionBenefits was triggered by checking
      // that users table was updated to set is_vip to false
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should handle SUBSCRIPTION_EXPIRED (type 13) and revoke VIP benefits', async () => {
      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-expired' },
          error: null,
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 13,
          purchaseToken: 'token_exp',
          subscriptionId: 'sub_monthly',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should warn on unhandled notification type', () => {
      const warnSpy = vi.spyOn(service['logger'], 'warn');

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 99,
          purchaseToken: 'token_unknown',
          subscriptionId: 'sub_unknown',
        },
      });

      service.handleNotification(msg);

      expect(warnSpy).toHaveBeenCalledWith(
        'Unhandled Google Play notification type: 99',
      );
    });

    it('should warn when user_id cannot be found for a purchase token', async () => {
      const warnSpy = vi.spyOn(service['logger'], 'warn');

      const singleton = {
        ...mockSupabaseClient,
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'not found' },
        }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(singleton);

      const msg = createPubSubMessage({
        subscriptionNotification: {
          version: '1.0',
          notificationType: 1,
          purchaseToken: 'unknown_token',
          subscriptionId: 'sub_monthly',
        },
      });

      service.handleNotification(msg);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(warnSpy).toHaveBeenCalledWith(
        'No user found for purchase token unknown_token',
      );
    });

    it('should log error on unexpected exceptions during processing', () => {
      const errorSpy = vi.spyOn(service['logger'], 'error');

      // A message that will cause JSON.parse to fail due to invalid base64
      const msg: Record<string, unknown> = {
        message: {
          data: '!!!not-valid-base64!!!',
        },
      };

      service.handleNotification(msg);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process Google Play notification'),
      );
    });
  });
});
