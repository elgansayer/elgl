import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatBackupService } from './chat-backup.service';
import { ImportChatBackupDto } from './dto/import-chat-backup.dto';

@Controller('chat-backup')
@UseGuards(SupabaseAuthGuard)
export class ChatBackupController {
  constructor(private readonly backupService: ChatBackupService) {}

  @Get('export/:roomId')
  async exportBackup(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @CurrentUser() user: User | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    if (!user) {
      throw new UnauthorizedException();
    }

    const backup = await this.backupService.exportRoomBackup(user.id, roomId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="chat-backup-${roomId}.json"`,
    );
    return backup;
  }

  @Post('import/:roomId')
  async importBackup(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() dto: ImportChatBackupDto,
    @CurrentUser() user: User | null,
  ): Promise<{ importedCount: number }> {
    if (!user) {
      throw new UnauthorizedException();
    }

    const importedCount = await this.backupService.importRoomBackup(
      user.id,
      roomId,
      dto.messages,
    );
    return { importedCount };
  }
}
