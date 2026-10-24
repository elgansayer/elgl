import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { WordOfTheDayController } from './word-of-the-day.controller';
import { WordOfTheDayService } from './word-of-the-day.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [WordOfTheDayController],
  providers: [WordOfTheDayService],
  exports: [WordOfTheDayService],
})
export class WordOfTheDayModule {}
