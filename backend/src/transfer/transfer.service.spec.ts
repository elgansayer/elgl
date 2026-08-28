import { Test, TestingModule } from '@nestjs/testing';
import { TransferService } from './transfer.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

describe('TransferService Constructor Validation', () => {
  let mockSupabaseService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockSupabaseService = {
      getRedisClient: vi.fn(),
    };
    mockConfigService = {
      get: vi.fn(),
    };
  });

  const createService = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    return module.get<TransferService>(TransferService);
  };

  it('should initialize successfully in production with a valid secret', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'TRANSFER_SECRET') return 'super-secure-production-secret';
      return null;
    });

    const service = await createService();
    expect(service).toBeDefined();
    // @ts-expect-error accessing private property for testing
    expect(service.secret).toBe('super-secure-production-secret');
  });

  it('should throw an error in production if TRANSFER_SECRET is missing', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'TRANSFER_SECRET') return undefined;
      return null;
    });

    await expect(createService()).rejects.toThrow(
      'TRANSFER_SECRET must be configured securely in production',
    );
  });

  it('should throw an error in production if TRANSFER_SECRET is device-transfer-secret-dev-only', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'TRANSFER_SECRET') return 'device-transfer-secret-dev-only';
      return null;
    });

    await expect(createService()).rejects.toThrow(
      'TRANSFER_SECRET must be configured securely in production',
    );
  });

  it('should throw an error in production if TRANSFER_SECRET is test-transfer-secret', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'TRANSFER_SECRET') return 'test-transfer-secret';
      return null;
    });

    await expect(createService()).rejects.toThrow(
      'TRANSFER_SECRET must be configured securely in production',
    );
  });

  it('should fallback to device-transfer-secret-dev-only in development if secret is missing', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'TRANSFER_SECRET') return undefined;
      return null;
    });

    const service = await createService();
    expect(service).toBeDefined();
    // @ts-expect-error accessing private property for testing
    expect(service.secret).toBe('device-transfer-secret-dev-only');
  });
});
