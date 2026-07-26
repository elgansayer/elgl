import {
  Body,
  Controller,
  Post,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { MediaService } from './media.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@Controller('media')
@UseGuards(SupabaseAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('cover/presigned-url')
  async getCoverPresignedUrl(
    @Req() req: { user: { id: string } },
    @Body() dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return this.mediaService.generateCoverPresignedUrl(req.user.id, dto);
  }

  @Post('voice-note')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVoiceNote(
    @Req() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No audio file uploaded');
    }
    return this.mediaService.uploadAndCompressVoiceNote(req.user.id, file);
  }

  @Post('cover/confirm')
  async confirmCoverUpload(
    @Req() req: { user: { id: string } },
    @Body('objectKey') objectKey: string,
  ): Promise<{ coverUrl: string }> {
    return this.mediaService.confirmCoverUpload(req.user.id, objectKey);
  }
}
