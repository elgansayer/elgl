import { TransferService } from './transfer.service';
import { vi } from 'vitest';

describe('TransferService', () => {
  let configServiceMock: { get: any };
  let supabaseServiceMock: any;

  beforeEach(() => {
    configServiceMock = {
      get: vi.fn(),
    };

    supabaseServiceMock = {
      getRedisClient: vi.fn(),
    };
  });

  describe('constructor', () => {
    it('should throw an error in production if TRANSFER_SECRET is missing', () => {
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'TRANSFER_SECRET') return undefined;
        return null;
      });

      expect(
        () =>
          new TransferService(
            supabaseServiceMock as any,
            configServiceMock as any,
          ),
      ).toThrow('TRANSFER_SECRET must be securely configured in production');
    });

    it('should throw an error in production if TRANSFER_SECRET is the dev default', () => {
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'TRANSFER_SECRET') return 'device-transfer-secret-dev-only';
        return null;
      });

      expect(
        () =>
          new TransferService(
            supabaseServiceMock as any,
            configServiceMock as any,
          ),
      ).toThrow('TRANSFER_SECRET must be securely configured in production');
    });

    it('should not throw in development if TRANSFER_SECRET is the dev default', () => {
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'TRANSFER_SECRET') return 'device-transfer-secret-dev-only';
        return null;
      });

      expect(
        () =>
          new TransferService(
            supabaseServiceMock as any,
            configServiceMock as any,
          ),
      ).not.toThrow();
    });

    it('should throw in development if TRANSFER_SECRET is missing', () => {
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'TRANSFER_SECRET') return undefined;
        return null;
      });

      expect(
        () =>
          new TransferService(
            supabaseServiceMock as any,
            configServiceMock as any,
          ),
      ).toThrow('TRANSFER_SECRET must be configured');
    });
  });
});
