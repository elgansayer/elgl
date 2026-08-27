import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('TransferController', () => {
  let controller: TransferController;
  let transferService: {
    generateTransferToken: Mock;
    consumeTransferToken: Mock;
    swapTokenForSession: Mock;
  };

  beforeEach(async () => {
    transferService = {
      generateTransferToken: vi.fn(),
      consumeTransferToken: vi.fn(),
      swapTokenForSession: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransferController],
      providers: [
        {
          provide: TransferService,
          useValue: transferService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TransferController>(TransferController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generate', () => {
    it('should throw UnauthorizedException when user id is missing', async () => {
      await expect(controller.generate({ user: {} })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return a URL built from APP_URL', async () => {
      const token = 'generated-token';
      transferService.generateTransferToken.mockResolvedValueOnce(token);

      const originalEnv = process.env.APP_URL;
      process.env.APP_URL = 'https://example.com';

      try {
        const result = await controller.generate({
          user: { id: 'user-123' },
        });
        expect(result).toEqual({
          url: 'https://example.com/device-transfer?token=generated-token',
        });
      } finally {
        if (originalEnv === undefined) {
          delete process.env.APP_URL;
        } else {
          process.env.APP_URL = originalEnv;
        }
      }

      expect(transferService.generateTransferToken).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should fall back to localhost when APP_URL is not set', async () => {
      const token = 'some-token';
      transferService.generateTransferToken.mockResolvedValueOnce(token);
      delete process.env.APP_URL;

      const result = await controller.generate({
        user: { id: 'u1' },
      });

      expect(result).toEqual({
        url: 'http://localhost:4200/device-transfer?token=some-token',
      });
    });
  });

  describe('consume (GET)', () => {
    it('should throw BadRequestException when token is missing', async () => {
      await expect(controller.consume(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token is invalid', async () => {
      transferService.consumeTransferToken.mockResolvedValueOnce(null);
      await expect(controller.consume('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return a swapToken for a valid token', async () => {
      const swapToken = 'swap-token';
      transferService.consumeTransferToken.mockResolvedValueOnce(swapToken);

      const result = await controller.consume('good-token');

      expect(result).toEqual({ swapToken });
      expect(transferService.consumeTransferToken).toHaveBeenCalledWith(
        'good-token',
      );
    });
  });

  describe('consume (POST)', () => {
    it('should throw BadRequestException when token is missing', async () => {
      await expect(controller.consumePost(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token is invalid', async () => {
      transferService.consumeTransferToken.mockResolvedValueOnce(null);
      await expect(controller.consumePost('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return a swapToken for a valid token', async () => {
      const swapToken = 'swap-token-from-post';
      transferService.consumeTransferToken.mockResolvedValueOnce(swapToken);

      const result = await controller.consumePost('good-token');

      expect(result).toEqual({ swapToken });
      expect(transferService.consumeTransferToken).toHaveBeenCalledWith(
        'good-token',
      );
    });
  });

  describe('swap', () => {
    it('should throw BadRequestException when swapToken is missing', async () => {
      await expect(controller.swap(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when swapToken is invalid', async () => {
      transferService.swapTokenForSession.mockResolvedValueOnce(null);
      await expect(controller.swap('bad-swap')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return the session result for a valid swap token', async () => {
      const sessionResult = { access_token: 'a', refresh_token: 'r' };
      transferService.swapTokenForSession.mockResolvedValueOnce(sessionResult);

      const result = await controller.swap('good-swap');

      expect(result).toEqual(sessionResult);
      expect(transferService.swapTokenForSession).toHaveBeenCalledWith(
        'good-swap',
      );
    });
  });
});
