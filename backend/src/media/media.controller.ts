import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(SupabaseAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presigned-url')
  async getPresignedUrl(
    @CurrentUser() user: User | null,
    @Body() dto: PresignedUrlDto,
  ): Promise<any> {
    if (!user) return null;
    return this.mediaService.generatePresignedUrl(user.id, dto);
  }

  @Post('cover/presigned-url')
  async getCoverPresignedUrl(
    @CurrentUser() user: User | null,
    @Body() dto: PresignedUrlDto,
  ): Promise<any> {
    if (!user) return null;
    return this.mediaService.generateCoverPresignedUrl(user.id, dto);
  }

  @Post('cover/confirm')
  async confirmCoverUpload(
    @CurrentUser() user: User | null,
    @Body('objectKey') objectKey: string,
  ): Promise<any> {
    if (!user) return null;
    return this.mediaService.confirmCoverUpload(user.id, objectKey);
  }
}
