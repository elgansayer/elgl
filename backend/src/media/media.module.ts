import { Module } from '@nestjs/common';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AudioCompressionService } from './audio-compression.service';
import { ImageCompressionService } from './image-compression.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { VideoCompressionService } from './video-compression.service';

@Module({
  imports: [SupabaseModule, CloudflareR2Module],
  controllers: [MediaController],
  providers: [
    MediaService,
    AudioCompressionService,
    ImageCompressionService,
    VideoCompressionService,
  ],
  exports: [MediaService, AudioCompressionService],
})
export class MediaModule {}
