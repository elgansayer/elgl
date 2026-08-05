import { EmailService } from './email.service';
import type { ConfigService } from '@nestjs/config';

jest.mock('nodemailer');

describe('EmailService (unit)', () => {
  let service: EmailService;
  let sendMailFn: jest.Mock;

  function mockSendMail(): jest.Mock {
    const fn = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    const nodemailer = require('nodemailer');
    nodemailer.createTransport = jest.fn(() => ({ sendMail: fn }));
    return fn;
  }

  function configGet(env: Record<string, string>) {
    return jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback);
  }

  beforeEach(() => {
    sendMailFn = mockSendMail();
    service = new EmailService({
      get: configGet({
        MAIL_HOST: 'smtp.test.com',
        MAIL_PORT: '587',
        MAIL_USER: 'testuser',
        MAIL_PASS: 'testpass',
        FRONTEND_URL: 'https://hellotalk.com',
        MAIL_FROM_NAME: 'HelloTalk',
        MAIL_FROM_ADDRESS: 'noreply@hellotalk.com',
      }),
    } as unknown as ConfigService);
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email with the correct subject and URL', async () => {
      sendMailFn.mockClear();
      await service.sendPasswordResetEmail('user@example.com', 'abc123token');

      expect(sendMailFn).toHaveBeenCalledTimes(1);
      const mailArgs = sendMailFn.mock.calls[0][0];
      expect(mailArgs.to).toBe('user@example.com');
      expect(mailArgs.subject).toBe('Reset your HelloTalk password');
      expect(mailArgs.from).toBe('"HelloTalk" <noreply@hellotalk.com>');
      expect(mailArgs.text).toContain('https://hellotalk.com/forgot-password?token=abc123token');
      expect(mailArgs.html).toContain('https://hellotalk.com/forgot-password?token=abc123token');
    });

    it('should use FRONTEND_URL env var for the reset link', async () => {
      const fn = mockSendMail();
      const customService = new EmailService({
        get: configGet({
          FRONTEND_URL: 'https://custom.app',
          MAIL_HOST: 'smtp.example.com',
          MAIL_PORT: '465',
          MAIL_USER: 'user',
          MAIL_PASS: 'pass',
          MAIL_FROM_NAME: 'App',
          MAIL_FROM_ADDRESS: 'no@reply.com',
        }),
      } as unknown as ConfigService);

      await customService.sendPasswordResetEmail('x@y.com', 'mytoken');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].text).toContain('https://custom.app/forgot-password?token=mytoken');
    });

    it('should default to localhost:4200 when FRONTEND_URL is not set', async () => {
      const fn = mockSendMail();
      const defaultService = new EmailService({
        get: jest.fn((_key: string, fallback?: unknown) => fallback),
      } as unknown as ConfigService);

      await defaultService.sendPasswordResetEmail('x@y.com', 'localtoken');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn.mock.calls[0][0].text).toContain('http://localhost:4200/forgot-password?token=localtoken');
    });
  });
});
