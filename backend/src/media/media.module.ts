import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AudioCompressionService } from './audio-compression.service';
import { ImageCompressionService } from './image-compression.service';

@Module({
  imports: [SupabaseModule],
  controllers: [MediaController],
  providers: [MediaService, AudioCompressionService, ImageCompressionService],
  exports: [MediaService, AudioCompressionService],
})
export class MediaModule {}
