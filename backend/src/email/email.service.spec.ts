import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue: string) => {
        const map: Record<string, string> = {
          MAIL_HOST: 'smtp.test.com',
          MAIL_PORT: '587',
          MAIL_USER: 'testuser',
          MAIL_PASS: 'testpass',
          FRONTEND_URL: 'http://localhost:4200',
          MAIL_FROM_NAME: 'HelloTalk',
          MAIL_FROM_ADDRESS: 'noreply@hellotalk.com',
        };
        return map[key] ?? defaultValue;
      }),
    };

    service = new EmailService(configService as unknown as ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email with the correct details', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'test-token-123');

      const nodemailer = require('nodemailer');
      const sendMail = nodemailer.createTransport().sendMail;
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"HelloTalk" <noreply@hellotalk.com>',
          to: 'user@example.com',
          subject: 'Reset your HelloTalk password',
          text: expect.stringContaining(
            'http://localhost:4200/forgot-password?token=test-token-123',
          ),
          html: expect.stringContaining(
            'http://localhost:4200/forgot-password?token=test-token-123',
          ),
        }),
      );
    });
  });
});