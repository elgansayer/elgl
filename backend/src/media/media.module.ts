import { Module } from '@nestjs/common';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AudioCompressionService } from './audio-compression.service';
import { ChatMediaController } from './chat-media.controller';
import { ChatMediaUploadService } from './chat-media-upload.service';
import { ImageCompressionService } from './image-compression.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [SupabaseModule, CloudflareR2Module],
  controllers: [MediaController, ChatMediaController],
  providers: [
    MediaService,
    ChatMediaUploadService,
    AudioCompressionService,
    ImageCompressionService,
  ],
  exports: [MediaService, AudioCompressionService],
})
export class MediaModule {}
