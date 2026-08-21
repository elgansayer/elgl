import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { HobbyTagsController } from './hobby-tags.controller';
import { HobbyTagsService } from './hobby-tags.service';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [HobbyTagsController],
  providers: [HobbyTagsService],
  exports: [HobbyTagsService],
})
export class HobbyTagsModule {}
