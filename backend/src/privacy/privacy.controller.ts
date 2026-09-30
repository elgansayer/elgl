import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ArchiveRequestDto } from './dto/archive-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import type { Request } from 'express';

@Controller('privacy')
@UseGuards(SupabaseAuthGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Post('request-archive')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestArchive(@Body() dto: ArchiveRequestDto, @Req() req: Request) {
    const userId = (req as any).user?.id ?? '';
    await this.privacyService.requestArchive(userId, dto);
    return {
      message: 'Archive requested. You will receive an email when ready.',
    };
  }

  @Post('delete-account')
  @HttpCode(HttpStatus.ACCEPTED)
  async deleteAccount(@Body() dto: DeleteAccountDto, @Req() req: Request) {
    const userId = (req as any).user?.id ?? '';
    await this.privacyService.deleteAccount(userId, dto);
    return {
      message: 'Account deletion initiated. You have 30 days to cancel.',
    };
  }

  @Post('cancel-deletion')
  @HttpCode(HttpStatus.OK)
  async cancelDeletion(@Req() req: Request) {
    const userId = (req as any).user?.id ?? '';
    await this.privacyService.cancelDeletion(userId);
    return { message: 'Account deletion cancelled successfully.' };
  }
}
