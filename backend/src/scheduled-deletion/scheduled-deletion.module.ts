import { Module } from '@nestjs/common';
import { ScheduledDeletionService } from './scheduled-deletion.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SupabaseModule, UsersModule],
  providers: [ScheduledDeletionService],
  exports: [ScheduledDeletionService],
})
export class ScheduledDeletionModule {}
