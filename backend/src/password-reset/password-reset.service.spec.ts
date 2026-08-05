import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PasswordResetService } from './password-reset.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

function createBuilder(initialResponse: any) {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  builder.then = jest.fn((resolve: any) => resolve(initialResponse));
  return builder;
}

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let supabaseService: any;
  let emailService: { sendPasswordResetEmail: jest.Mock };
  let usersBuilder: any;
  let tokensBuilder: any;

  beforeEach(async () => {
    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    usersBuilder = createBuilder({ data: [], error: null });
    tokensBuilder = createBuilder({ data: null, error: null });

    const mockClient = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'users') return usersBuilder;
        if (table === 'password_reset_tokens') return tokensBuilder;
        return createBuilder({ data: null, error: null });
      }),
      auth: {
        admin: {
          updateUserById: jest.fn().mockResolvedValue({ error: null }),
        },
      },
    };

    supabaseService = { getClient: jest.fn().mockReturnValue(mockClient) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        ConfigService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestPasswordReset', () => {
    it('should send an email when user exists', async () => {
      // First call: from('users').select('id').eq('email', email)
      usersBuilder.then = jest.fn((r: any) => r({ data: [{ id: 'user-123' }], error: null }));
      // Second call: from('password_reset_tokens').insert({...})
      tokensBuilder.then = jest.fn((r: any) => r({ data: null, error: null }));

      await service.requestPasswordReset({ email: 'user@example.com' });

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
    });

    it('should not leak user existence', async () => {
      usersBuilder.then = jest.fn((r: any) => r({ data: [], error: null }));

      await service.requestPasswordReset({ email: 'unknown@example.com' });

      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw on insert failure', async () => {
      usersBuilder.then = jest.fn((r: any) => r({ data: [{ id: 'user-123' }], error: null }));
      tokensBuilder.then = jest.fn((r: any) => r({ error: new Error('DB error') }));

      await expect(
        service.requestPasswordReset({ email: 'user@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should update password with valid token', async () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      // .select('user_id, expires_at').eq('token', t).eq('used', false).single()
      tokensBuilder.then = jest.fn((r: any) =>
        r({ data: { user_id: 'uid-1', expires_at: future }, error: null }),
      );

      await service.resetPassword({ token: 't', newPassword: 'p' });

      expect(
        supabaseService.getClient().auth.admin.updateUserById,
      ).toHaveBeenCalledWith('uid-1', { password: 'p' });
    });

    it('should throw Unauthorized for invalid token', async () => {
      tokensBuilder.then = jest.fn((r: any) =>
        r({ data: null, error: new Error('not found') }),
      );

      await expect(
        service.resetPassword({ token: 'bad', newPassword: 'p' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw Unauthorized for expired token', async () => {
      const past = new Date(Date.now() - 3600_000).toISOString();
      tokensBuilder.then = jest.fn((r: any) =>
        r({ data: { user_id: 'uid-1', expires_at: past }, error: null }),
      );

      await expect(
        service.resetPassword({ token: 'old', newPassword: 'p' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
