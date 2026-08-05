import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let sendMailSpy: jest.Mock;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        MAIL_HOST: 'smtp.hellotalk.com',
        MAIL_PORT: '587',
        MAIL_USER: 'apitest@hellotalk.com',
        MAIL_PASS: 'secret',
        FRONTEND_URL: 'http://localhost:4200',
        MAIL_FROM_NAME: 'HelloTalk',
        MAIL_FROM_ADDRESS: 'noreply@hellotalk.com',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    const transporter = (nodemailer.createTransport as jest.Mock).mock
      .results[0].value;
    sendMailSpy = transporter.sendMail;
    sendMailSpy.mockClear();
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email with the correct details', async () => {
      await service.sendPasswordResetEmail('user@test.com', 'abc123token');

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      const mailOptions = sendMailSpy.mock.calls[0][0];

      expect(mailOptions.to).toBe('user@test.com');
      expect(mailOptions.subject).toBe('Reset your HelloTalk password');
      expect(mailOptions.text).toContain('abc123token');
      expect(mailOptions.text).toContain(
        'http://localhost:4200/forgot-password?token=abc123token',
      );
      expect(mailOptions.html).toContain('abc123token');
      expect(mailOptions.from).toBe(
        '"HelloTalk" <noreply@hellotalk.com>',
      );
    });

    it('should use custom from name and address from config', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                const custom: Record<string, string> = {
                  MAIL_HOST: 'smtp.custom.com',
                  MAIL_PORT: '465',
                  MAIL_USER: 'custom@custom.com',
                  MAIL_PASS: 'custompass',
                  FRONTEND_URL: 'https://hellotalk.app',
                  MAIL_FROM_NAME: 'HT Support',
                  MAIL_FROM_ADDRESS: 'support@hellotalk.app',
                };
                return custom[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const customService = module.get<EmailService>(EmailService);
      const customTransporter = (nodemailer.createTransport as jest.Mock).mock
        .results[1].value;
      const customSendMail = customTransporter.sendMail;

      await customService.sendPasswordResetEmail('someone@test.com', 'token456');

      expect(customSendMail).toHaveBeenCalledTimes(1);
      const mail = customSendMail.mock.calls[0][0];
      expect(mail.from).toBe('"HT Support" <support@hellotalk.app>');
      expect(mail.text).toContain(
        'https://hellotalk.app/forgot-password?token=token456',
      );
    });
  });
});