import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PrivacyService } from './privacy.service';
import { ArchiveRequestDto } from './dto/archive-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Controller('privacy')
@UseGuards(SupabaseAuthGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  async getStatus(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.privacyService.getStatus(user.id);
  }

  @Post('request-archive')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  async requestArchive(
    @Body() dto: ArchiveRequestDto,
    @CurrentUser() user: User | null,
  ) {
    if (!user) throw new UnauthorizedException();
    const archive = await this.privacyService.requestArchive(user.id, dto);
    return {
      ...archive,
      message:
        archive.status === 'ready'
          ? 'Archive ready for download.'
          : 'Archive preparation is already in progress.',
    };
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  async deleteAccount(
    @Body() dto: DeleteAccountDto,
    @CurrentUser() user: User | null,
  ) {
    if (!user) throw new UnauthorizedException();
    await this.privacyService.deleteAccount(user.id, dto);
    return {
      message: 'Account deletion initiated. You have 30 days to cancel.',
    };
  }

  @Post('cancel-deletion')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  async cancelDeletion(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    await this.privacyService.cancelDeletion(user.id);
    return { message: 'Account deletion cancelled successfully.' };
  }
}
