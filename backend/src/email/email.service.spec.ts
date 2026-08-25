import type { Mock } from 'vitest';
import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  }),
}));

const VALID_TOKEN = 'a'.repeat(64);

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
    it('sends a password reset email with the correct fields', async () => {
      await service.sendPasswordResetEmail('user@example.com', VALID_TOKEN);

      expect(transporter.sendMail).toHaveBeenCalledTimes(1);
      const mailOptions = transporter.sendMail.mock.calls[0][0];

      expect(mailOptions.to).toBe('user@example.com');
      expect(mailOptions.subject).toContain('password');
      expect(mailOptions.from).toContain('HelloTalk');
      expect(mailOptions.text).toContain(VALID_TOKEN);
      expect(mailOptions.html).toContain(VALID_TOKEN);
      expect(mailOptions.text).toContain('expires after 30 minutes');
    });

    it('uses the canonical reset-password route', async () => {
      configService.get = vi.fn((key: string, fallback: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.example.com/app/';
        return fallback;
      });
      const svc = new (EmailService as any)(configService) as EmailService;
      (svc as any).transporter = transporter;

      await svc.sendPasswordResetEmail('user@example.com', VALID_TOKEN);

      const mailOptions = transporter.sendMail.mock.calls[0][0];
      const expected = `https://app.example.com/reset-password?token=${VALID_TOKEN}`;
      expect(mailOptions.text).toContain(expected);
      expect(mailOptions.html).toContain(expected);
      expect(mailOptions.text).not.toContain('/forgot-password?token=');
    });

    it('rejects malformed tokens before dispatch', async () => {
      await expect(
        service.sendPasswordResetEmail('user@example.com', 'not-a-reset-token'),
      ).rejects.toThrow('Invalid password reset token');
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it('rejects non-http frontend URLs before dispatch', async () => {
      configService.get = vi.fn((key: string, fallback: string) => {
        if (key === 'FRONTEND_URL') return 'file:///tmp/app';
        return fallback;
      });
      const svc = new (EmailService as any)(configService) as EmailService;
      (svc as any).transporter = transporter;

      await expect(
        svc.sendPasswordResetEmail('user@example.com', VALID_TOKEN),
      ).rejects.toThrow('Invalid password reset frontend URL');
      expect(transporter.sendMail).not.toHaveBeenCalled();
    });

    it('uses custom MAIL_FROM_NAME and MAIL_FROM_ADDRESS when configured', async () => {
      configService.get = vi.fn((key: string, fallback: string) => {
        const overrides: Record<string, string> = {
          MAIL_FROM_NAME: 'HelloTalk Support',
          MAIL_FROM_ADDRESS: 'support@hellotalk.app',
        };
        return overrides[key] ?? fallback;
      });
      const svc = new (EmailService as any)(configService) as EmailService;
      (svc as any).transporter = transporter;

      await svc.sendPasswordResetEmail('user@example.com', VALID_TOKEN);

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
        VALID_TOKEN,
      );

      expect(logSpy).toHaveBeenCalledWith('Password reset email dispatched');
      const loggedText = logSpy.mock.calls.flat().join(' ');
      expect(loggedText).not.toContain('private-user@example.com');
      expect(loggedText).not.toContain(VALID_TOKEN);
    });
  });
});
