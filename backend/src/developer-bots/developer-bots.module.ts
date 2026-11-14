import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { DeveloperBotsController } from './developer-bots.controller';
import { DeveloperBotsService } from './developer-bots.service';

@Module({
  imports: [SupabaseModule],
  controllers: [DeveloperBotsController],
  providers: [DeveloperBotsService],
  exports: [DeveloperBotsService],
})
export class DeveloperBotsModule {}
