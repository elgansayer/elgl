import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  imports: [ConfigModule],
  controllers: [TransferController],
  providers: [TransferService, SupabaseService],
  exports: [TransferService],
})
export class TransferModule {}
