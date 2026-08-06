import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockSupabase: Record<string, unknown>;
  let mockEmailService: { sendPasswordResetEmail: jest.Mock };

  beforeEach(async () => {
    mockSupabase = {
      from: jest.fn(),
      auth: {
        admin: {
          listUsers: jest.fn(),
          updateUserById: jest.fn(),
        },
      },
    };

    mockEmailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabase },
        },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = moduleRef.get(PasswordResetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('should silently return when no user is found', async () => {
      (mockSupabase.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: { users: [] },
        error: null,
      });

      await service.requestPasswordReset({ email: 'nobody@example.com' });

      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should send reset email when user is found in listUsers', async () => {
      (mockSupabase.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: {
          users: [{ id: 'user-1', email: 'user@example.com' }],
        },
        error: null,
      });

      const insertBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(insertBuilder);

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          used: false,
        }),
      );
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
    });

    it('should match email case-insensitively', async () => {
      (mockSupabase.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: {
          users: [{ id: 'user-1', email: 'User@Example.com' }],
        },
        error: null,
      });

      const insertBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(insertBuilder);

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1' }),
      );
    });

    it('should throw BadRequestException when token insert fails', async () => {
      (mockSupabase.auth.admin.listUsers as jest.Mock).mockResolvedValue({
        data: {
          users: [{ id: 'user-1', email: 'user@example.com' }],
        },
        error: null,
      });

      const insertBuilder = {
        insert: jest.fn().mockResolvedValue({
          error: new Error('insert failed'),
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(insertBuilder);

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should throw for invalid token', async () => {
      const selectBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'not found' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(selectBuilder);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired token', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const selectBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user-1', expires_at: pastDate.toISOString() },
          error: null,
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(selectBuilder);

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update password and mark token used for valid request', async () => {
      const futureDate = new Date(Date.now() + 3600000);

      const selectBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user-abc', expires_at: futureDate.toISOString() },
          error: null,
        }),
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      (mockSupabase.from as jest.Mock)
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(updateBuilder);
      (mockSupabase.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        error: null,
      });

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newPass123!',
      });

      expect(
        mockSupabase.auth.admin.updateUserById as jest.Mock,
      ).toHaveBeenCalledWith('user-abc', { password: 'newPass123!' });
      expect(updateBuilder.update).toHaveBeenCalledWith({ used: true });
      expect(updateBuilder.eq).toHaveBeenCalledWith('token', 'valid-token');
    });

    it('should throw BadRequestException when password update fails', async () => {
      const futureDate = new Date(Date.now() + 3600000);

      const selectBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { user_id: 'user-abc', expires_at: futureDate.toISOString() },
          error: null,
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValue(selectBuilder);
      (mockSupabase.auth.admin.updateUserById as jest.Mock).mockResolvedValue({
        error: new Error('auth update failed'),
      });

      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});