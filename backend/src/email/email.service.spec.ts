import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        MAIL_HOST: 'smtp.test.com',
        MAIL_PORT: '587',
        MAIL_USER: 'testuser',
        MAIL_PASS: 'testpass',
        FRONTEND_URL: 'http://localhost:4200',
        MAIL_FROM_NAME: 'HelloTalk',
        MAIL_FROM_ADDRESS: 'noreply@hellotalk.com',
      };
      if (key === 'MAIL_PORT') return 587;
      return config[key] ?? defaultValue ?? '';
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create nodemailer transport with correct config', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: { user: 'testuser', pass: 'testpass' },
      }),
    );
  });

  it('should send password reset email with correct parameters', async () => {
    const transporter = (nodemailer.createTransport as jest.Mock).mock.results[0].value;

    await service.sendPasswordResetEmail('user@example.com', 'reset-token-abc');

    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining('HelloTalk'),
        to: 'user@example.com',
        subject: 'Reset your HelloTalk password',
        text: expect.stringContaining('reset-token-abc'),
        html: expect.stringContaining('reset-token-abc'),
      }),
    );
  });

  it('should include the correct reset URL in the email', async () => {
    const transporter = (nodemailer.createTransport as jest.Mock).mock.results[0].value;

    await service.sendPasswordResetEmail('user@example.com', 'my-test-token');

    const callArgs = (transporter.sendMail as jest.Mock).mock.calls[0][0] as { text: string; html: string };
    expect(callArgs.text).toContain('http://localhost:4200/forgot-password?token=my-test-token');
    expect(callArgs.html).toContain('http://localhost:4200/forgot-password?token=my-test-token');
  });
});