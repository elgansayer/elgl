import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>(
      'MAIL_HOST',
      'smtp.example.com',
    );
    const port = this.configService.get<number>('MAIL_PORT', 587);
    const user = this.configService.get<string>('MAIL_USER', '');
    const pass = this.configService.get<string>('MAIL_PASS', '');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );
    const resetUrl = `${frontendUrl}/forgot-password?token=${token}`;
    const subject = 'Reset your HelloTalk password';
    const text = `You have requested a password reset. Please use the following link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\n- HelloTalk Team`;
    const html = `<p>You have requested a password reset. Please click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, please ignore this email.</p><p>- HelloTalk Team</p>`;

    const fromName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'HelloTalk',
    );
    const fromAddress = this.configService.get<string>(
      'MAIL_FROM_ADDRESS',
      'noreply@hellotalk.com',
    );

    await this.transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    });

    // Do not log recipient PII or reset credentials.
    this.logger.log('Password reset email dispatched');
  }
}
