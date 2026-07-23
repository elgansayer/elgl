import { Body, Controller, Post, UseGuards, Req } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { MediaService } from './media.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@Controller('media')
@UseGuards(SupabaseAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('cover/presigned-url')
  async getCoverPresignedUrl(
    @Req() req: any,
    @Body() dto: PresignedUrlDto,
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    return this.mediaService.generateCoverPresignedUrl(req.user.id, dto);
  }

  @Post('cover/confirm')
  async confirmCoverUpload(
    @Req() req: any,
    @Body('objectKey') objectKey: string,
  ): Promise<{ coverUrl: string }> {
    return this.mediaService.confirmCoverUpload(req.user.id, objectKey);
  }
}
