import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

@Module({
  imports: [SupabaseModule],
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
