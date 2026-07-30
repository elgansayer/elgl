import { Global, Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { TransferModule } from '../transfer/transfer.module';

@Global()
@Module({
  imports: [TwoFactorModule, TransferModule],
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard, TransferModule],
})
export class AuthModule {}
