import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let sendMailMock: jest.Mock;

  beforeEach(async () => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              const config: Record<string, string | number> = {
                MAIL_HOST: 'smtp.test.com',
                MAIL_PORT: 587,
                MAIL_USER: 'test@test.com',
                MAIL_PASS: 'testpass',
                FRONTEND_URL: 'http://localhost:4200',
                MAIL_FROM_NAME: 'HelloTalk',
                MAIL_FROM_ADDRESS: 'noreply@hellotalk.com',
              };
              return config[key] ?? defaultValue;
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email to the specified address', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'reset-token-123');

      expect(sendMailMock).toHaveBeenCalledTimes(1);

      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.to).toBe('user@example.com');
      expect(callArgs.subject).toBe('Reset your HelloTalk password');
      expect(callArgs.html).toContain('reset-token-123');
      expect(callArgs.html).toContain('forgot-password?token=reset-token-123');
      expect(callArgs.text).toContain('reset-token-123');
      expect(callArgs.from).toContain('HelloTalk');
      expect(callArgs.from).toContain('noreply@hellotalk.com');
    });

    it('should include the correct frontend URL in the reset link', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'token-456');

      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'http://localhost:4200/forgot-password?token=token-456',
      );
      expect(callArgs.text).toContain(
        'http://localhost:4200/forgot-password?token=token-456',
      );
    });

    it('should use the configured from name and address', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'token');

      const callArgs = sendMailMock.mock.calls[0][0];
      expect(callArgs.from).toBe('"HelloTalk" <noreply@hellotalk.com>');
    });

    it('should log the password reset email being sent', async () => {
      const logSpy = jest.spyOn(service['logger'] as { log: (...args: unknown[]) => void }, 'log');

      await service.sendPasswordResetEmail('user@example.com', 'token');

      expect(logSpy).toHaveBeenCalledWith(
        'Password reset email sent to user@example.com',
      );
    });

    it('should create transport with secure: false for port 587', async () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: { user: 'test@test.com', pass: 'testpass' },
        }),
      );
    });
  });
});