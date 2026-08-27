import { Module } from '@nestjs/common';
import { AudioIntroController } from './audio-intro.controller';
import { AudioIntroService } from './audio-intro.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AudioIntroController],
  providers: [AudioIntroService],
  exports: [AudioIntroService],
})
export class AudioIntroModule {}
