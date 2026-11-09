import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
