import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AudioCompressionService } from './audio-compression.service';
import { ChatMediaController } from './chat-media.controller';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMediaUploadService } from './chat-media-upload.service';
import { ImageCompressionService } from './image-compression.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [SupabaseModule, CloudflareR2Module, ChatModule],
  controllers: [MediaController, ChatMediaController],
  providers: [
    MediaService,
    ChatMediaUploadService,
    ChatMediaMessageService,
    AudioCompressionService,
    ImageCompressionService,
  ],
  exports: [MediaService, AudioCompressionService],
})
export class MediaModule {}
