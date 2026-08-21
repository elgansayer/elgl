import type { Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  }),
}));

describe('EmailService (unit)', () => {
  let service: EmailService;
  let configService: { get: Mock };
  let transporter: { sendMail: Mock };

  beforeEach(() => {
    transporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'abc-123' }),
    };

    configService = {
      get: vi.fn((key: string, fallback: string) => fallback),
    };

    service = new (EmailService as Record<string, never>)(
      configService,
    ) as EmailService;
    (service as any).transporter = transporter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email with the correct fields', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'abc-token-xyz');

      expect(transporter.sendMail).toHaveBeenCalledTimes(1);
      const mailOptions = transporter.sendMail.mock.calls[0][0];

      expect(mailOptions.to).toBe('user@example.com');
      expect(mailOptions.subject).toContain('password');
      expect(mailOptions.from).toContain('HelloTalk');
      expect(mailOptions.text).toContain('abc-token-xyz');
      expect(mailOptions.html).toContain('abc-token-xyz');
    });

    it('should include the frontend URL and token in the reset link', async () => {
      configService.get = vi.fn((key: string, fallback: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.example.com';
        return fallback;
      });
      const svc = new (EmailService as any)(configService) as EmailService;
      (svc as any).transporter = transporter;

      await svc.sendPasswordResetEmail('user@example.com', 'my-token');

      const mailOptions = transporter.sendMail.mock.calls[0][0];
      expect(mailOptions.text).toContain(
        'https://app.example.com/forgot-password?token=my-token',
      );
      expect(mailOptions.html).toContain(
        'https://app.example.com/forgot-password?token=my-token',
      );
    });

    it('should use custom MAIL_FROM_NAME and MAIL_FROM_ADDRESS when configured', async () => {
      configService.get = vi.fn((key: string, fallback: string) => {
        const overrides: Record<string, string> = {
          MAIL_FROM_NAME: 'HelloTalk Support',
          MAIL_FROM_ADDRESS: 'support@hellotalk.app',
        };
        return overrides[key] ?? fallback;
      });
      const svc = new (EmailService as any)(configService) as EmailService;
      (svc as any).transporter = transporter;

      await svc.sendPasswordResetEmail('user@example.com', 'tok');

      const mailOptions = transporter.sendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe(
        '"HelloTalk Support" <support@hellotalk.app>',
      );
    });

    it('does not log the recipient email address or reset token', async () => {
      const logSpy = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await service.sendPasswordResetEmail(
        'private-user@example.com',
        'secret-reset-token',
      );

      expect(logSpy).toHaveBeenCalledWith('Password reset email dispatched');
      const loggedText = logSpy.mock.calls.flat().join(' ');
      expect(loggedText).not.toContain('private-user@example.com');
      expect(loggedText).not.toContain('secret-reset-token');
    });
  });
});
