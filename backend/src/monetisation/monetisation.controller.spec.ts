import { Test, TestingModule } from '@nestjs/testing';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('MonetisationController', () => {
  let controller: MonetisationController;
  let monetisationService: MonetisationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonetisationController],
      providers: [
        {
          provide: MonetisationService,
          useValue: {
            upgradeUser: jest.fn(),
            handleStripeWebhook: jest.fn(),
            generateApiKey: jest.fn(),
            getDeveloperAnalytics: jest.fn(),
            getDiagnosticLogs: jest.fn(),
            createDiagnosticLog: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MonetisationController>(MonetisationController);
    monetisationService = module.get<MonetisationService>(MonetisationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upgradeVip', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.upgradeVip(null, {} as any);
      expect(result).toBeNull();
      expect(monetisationService.upgradeUser).not.toHaveBeenCalled();
    });

    it('should call service upgradeUser when user is provided', async () => {
      const dto: any = { tier: 'consumer' };
      const row: any = { id: 'user-1', is_vip: true, vip_tier: 'consumer' };
      (monetisationService.upgradeUser as jest.Mock).mockResolvedValue(row);

      const result = await controller.upgradeVip({ id: 'user-1' } as any, dto);
      expect(monetisationService.upgradeUser).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(row);
    });
  });

  describe('handleWebhook', () => {
    it('should pass webhook DTO to service and return result', async () => {
      const dto: any = { type: 'checkout.session.completed' };
      const response = { received: true, status: 'processed' };
      (monetisationService.handleStripeWebhook as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.handleWebhook(dto);
      expect(monetisationService.handleStripeWebhook).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('generateApiKey', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.generateApiKey(null);
      expect(result).toBeNull();
      expect(monetisationService.generateApiKey).not.toHaveBeenCalled();
    });

    it('should call service generateApiKey when user is provided', async () => {
      const response = {
        api_key: 'ht_dev_key',
        tier: 'developer',
        rate_limit_rpm: 600,
      };
      (monetisationService.generateApiKey as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.generateApiKey({ id: 'user-1' } as any);
      expect(monetisationService.generateApiKey).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });
  });

  describe('getAnalytics', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getAnalytics(null);
      expect(result).toBeNull();
      expect(monetisationService.getDeveloperAnalytics).not.toHaveBeenCalled();
    });

    it('should call service getDeveloperAnalytics when user is provided', async () => {
      const response = {
        api_key: 'ht_dev_key',
        tier: 'developer',
        total_api_calls_today: 1420,
        avg_latency_ms: 18,
        pricing_info: 'Developer Tier: 20 UKP / $26 USD per month',
      };
      (
        monetisationService.getDeveloperAnalytics as jest.Mock
      ).mockResolvedValue(response);

      const result = await controller.getAnalytics({ id: 'user-1' } as any);
      expect(monetisationService.getDeveloperAnalytics).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(response);
    });

    describe('getDiagnosticLogs', () => {
      it('should return logs from service', async () => {
        const logs = [{ id: 'log-1', category: 'POSTGIS' }];
        (monetisationService.getDiagnosticLogs as jest.Mock).mockResolvedValue(
          logs,
        );

        const result = await controller.getDiagnosticLogs();
        expect(monetisationService.getDiagnosticLogs).toHaveBeenCalled();
        expect(result).toEqual(logs);
      });
    });

    describe('createDiagnosticLog', () => {
      it('should return null if user is not provided', async () => {
        const result = await controller.createDiagnosticLog(null, {} as any);
        expect(result).toBeNull();
        expect(monetisationService.createDiagnosticLog).not.toHaveBeenCalled();
      });

      it('should create log through service when user is provided', async () => {
        const dto: any = {
          category: 'REDIS',
          status: 'success',
          message: 'ok',
        };
        const log = { id: 'log-2', ...dto };
        (
          monetisationService.createDiagnosticLog as jest.Mock
        ).mockResolvedValue(log);

        const result = await controller.createDiagnosticLog(
          { id: 'user-1' } as any,
          dto,
        );
        expect(monetisationService.createDiagnosticLog).toHaveBeenCalledWith(
          'user-1',
          dto,
        );
        expect(result).toEqual(log);
      });
    });
  });
});
