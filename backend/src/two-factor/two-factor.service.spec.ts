import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorService } from './two-factor.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

vi.mock('speakeasy');
vi.mock('qrcode');

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let supabaseService: { getClient: Mock };

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSecret', () => {
    it('should generate a secret and QR code URL', async () => {
      const userId = 'test-user';
      const mockSecret = {
        base32: 'mockBase32',
        otpauth_url: 'mockOtpauthUrl',
      };
      const mockQrCodeUrl = 'mockQrCodeUrl';

      (speakeasy.generateSecret as Mock).mockReturnValue(mockSecret);
      (qrcode.toDataURL as Mock).mockResolvedValue(mockQrCodeUrl);

      const result = await service.generateSecret(userId);

      expect(result).toEqual({
        secret: 'mockBase32',
        qrCodeUrl: 'mockQrCodeUrl',
      });
      expect(supabaseService.getClient().from).toHaveBeenCalledWith('users');
      expect(supabaseService.getClient().update).toHaveBeenCalledWith({
        totp_secret: 'mockBase32',
        two_factor_secret: 'mockBase32',
        two_factor_enabled: true,
      });
    });

    it('should throw an error if otpauth_url is missing', async () => {
      const userId = 'test-user';
      const mockSecret = { base32: 'mockBase32' };

      (speakeasy.generateSecret as Mock).mockReturnValue(mockSecret);

      await expect(service.generateSecret(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const userId = 'test-user';
      const token = '123456';
      const mockData = { totp_secret: 'mockSecret' };

      supabaseService
        .getClient()
        .single.mockResolvedValue({ data: mockData, error: null });
      (speakeasy.totp.verify as Mock).mockReturnValue(true);

      const result = await service.verifyToken(userId, token);

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'mockSecret',
        encoding: 'base32',
        token,
        window: 2,
      });
    });

    it('should throw an error if no secret is found', async () => {
      const userId = 'test-user';
      const token = '123456';

      supabaseService
        .getClient()
        .single.mockResolvedValue({ data: null, error: null });

      await expect(service.verifyToken(userId, token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('disable', () => {
    it('should disable two-factor authentication', async () => {
      const userId = 'test-user';
      const token = '123456';

      vi.spyOn(service, 'verifyToken').mockResolvedValue(true);

      await service.disable(userId, token);

      expect(supabaseService.getClient().update).toHaveBeenCalledWith({
        totp_secret: null,
        two_factor_secret: null,
        two_factor_enabled: false,
      });
    });

    it('should throw an error if the token is invalid', async () => {
      const userId = 'test-user';
      const token = '123456';

      vi.spyOn(service, 'verifyToken').mockResolvedValue(false);

      await expect(service.disable(userId, token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('isEnabled', () => {
    it('should return true if two-factor authentication is enabled', async () => {
      const userId = 'test-user';
      const mockData = { totp_secret: 'mockSecret' };

      supabaseService
        .getClient()
        .single.mockResolvedValue({ data: mockData, error: null });

      const result = await service.isEnabled(userId);

      expect(result).toBe(true);
    });

    it('should return false if two-factor authentication is not enabled', async () => {
      const userId = 'test-user';

      supabaseService
        .getClient()
        .single.mockResolvedValue({ data: null, error: null });

      const result = await service.isEnabled(userId);

      expect(result).toBe(false);
    });
  });
});
