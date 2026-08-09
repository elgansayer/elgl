import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [TransferController],
  providers: [TransferService, SupabaseService],
  exports: [TransferService],
})
export class TransferModule {}
