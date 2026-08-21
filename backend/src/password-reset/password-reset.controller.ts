import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PasswordResetService } from './password-reset.service';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class PasswordResetController {
  private readonly logger = new Logger(PasswordResetController.name);

  constructor(private readonly resetService: PasswordResetService) {}

<<<<<<< HEAD
  @Throttle({ default: { limit: 2, ttl: 60000 } })
=======
  @Throttle({ default: { limit: 3, ttl: 300000 } })
>>>>>>> origin/main
  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    try {
      await this.resetService.requestPasswordReset(dto);
    } catch {
      // Always return the same public response so infrastructure failures cannot
      // be used to distinguish registered from unregistered email addresses.
      this.logger.error('Password reset request failed before completion');
    }

    return {
      message: 'If the email address exists, a reset link has been sent.',
    };
  }

<<<<<<< HEAD
  @Throttle({ default: { limit: 2, ttl: 60000 } })
=======
  @Throttle({ default: { limit: 3, ttl: 300000 } })
>>>>>>> origin/main
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.resetService.resetPassword(dto);
    return { message: 'Password has been successfully reset.' };
  }
}
