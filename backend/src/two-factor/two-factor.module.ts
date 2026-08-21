import { Module } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorGuard } from './two-factor.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [TwoFactorController],
  providers: [TwoFactorService, SupabaseService, TwoFactorGuard],
  exports: [TwoFactorService, TwoFactorGuard],
})
export class TwoFactorModule {}
