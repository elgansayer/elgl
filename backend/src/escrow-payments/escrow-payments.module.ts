import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { EscrowPaymentsController } from './escrow-payments.controller';
import { EscrowPaymentsService } from './escrow-payments.service';
import { EscrowExceptionFilter } from './filters/escrow-exception.filter';

@Module({
  imports: [SupabaseModule, AnalyticsModule],
  controllers: [EscrowPaymentsController],
  providers: [
    EscrowPaymentsService,
    {
      provide: APP_FILTER,
      useClass: EscrowExceptionFilter,
    },
  ],
  exports: [EscrowPaymentsService],
})
export class EscrowPaymentsModule {}