import { Module } from '@nestjs/common';
import { LinkedAccountsController } from './linked-accounts.controller';
import { LinkedAccountsService } from './linked-accounts.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [LinkedAccountsController],
  providers: [LinkedAccountsService],
  exports: [LinkedAccountsService],
})
export class LinkedAccountsModule {}
