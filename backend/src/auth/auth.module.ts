import { Global, Module } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { TwoFactorModule } from '../two-factor/two-factor.module';

@Global()
@Module({
  imports: [TwoFactorModule],
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class AuthModule {}
