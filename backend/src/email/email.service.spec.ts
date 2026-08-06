import { EmailService } from './email.service';

describe('EmailService (unit)', () => {
  let service: EmailService;
  let configService: { get: jest.Mock };
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });

    const createTransportMock = jest.fn().mockReturnValue({
      sendMail: sendMailMock,
    });

    jest.mock('nodemailer', () => ({
      createTransport: createTransportMock,
    }));

    configService = {
      get: jest.fn((key: string, _default?: string) => {
        const map: Record<string, string> = {
          MAIL_HOST: 'smtp.test.com',
          MAIL_PORT: '587',
          MAIL_USER: 'test-user',
          MAIL_PASS: 'test-pass',
          FRONTEND_URL: 'http://localhost:4200',
          MAIL_FROM_NAME: 'HelloTalk',
          MAIL_FROM_ADDRESS: 'noreply@hellotalk.com',
        };
        return map[key] ?? _default ?? '';
      }),
    };

    service = new EmailService(configService as any);
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email with the correct reset URL', async () => {
      // Override the internal transporter's sendMail after construction
      (service as any).transporter.sendMail = sendMailMock;

      await service.sendPasswordResetEmail('user@example.com', 'abc123');

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Reset your HelloTalk password',
          text: expect.stringContaining(
            'http://localhost:4200/forgot-password?token=abc123',
          ),
          html: expect.stringContaining(
            'http://localhost:4200/forgot-password?token=abc123',
          ),
        }),
      );
    });
  });
});