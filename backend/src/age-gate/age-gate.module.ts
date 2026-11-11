import { Module } from '@nestjs/common';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AgeGateController } from './age-gate.controller';
import { AgeGateService } from './age-gate.service';

/**
 * AgeGateStatusService, which SupabaseAuthGuard consults on every request, is
 * provided and exported by the global AuthModule so each feature module's guard
 * instance can resolve it.
 */
@Module({
  imports: [SupabaseModule, SafetyModule],
  controllers: [AgeGateController],
  providers: [AgeGateService],
  exports: [AgeGateService],
})
export class AgeGateModule {}
