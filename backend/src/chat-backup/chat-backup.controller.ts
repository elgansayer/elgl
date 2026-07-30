import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatBackupService } from './chat-backup.service';

@Controller('chat-backup')
@UseGuards(SupabaseAuthGuard)
export class ChatBackupController {
  constructor(private readonly backupService: ChatBackupService) {}

  @Get('export/:channelId')
  async exportBackup(
    @Param('channelId') channelId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const messages = await this.backupService.exportChannelBackup(channelId);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="chat-backup-${channelId}.json"`,
      );
      res.json(messages);
    } catch (err) {
      throw new HttpException(
        (err as Error).message || 'Failed to export backup',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('import/:channelId')
  async importBackup(
    @Param('channelId') channelId: string,
    @Body('messages') messages: Record<string, unknown>[],
  ): Promise<{ importedCount: number }> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpException(
        'messages array is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const count = await this.backupService.importChannelBackup(
        channelId,
        messages,
      );
      return { importedCount: count };
    } catch (err) {
      throw new HttpException(
        (err as Error).message || 'Failed to import backup',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
