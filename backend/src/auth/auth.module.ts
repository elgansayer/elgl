import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { TransferModule } from '../transfer/transfer.module';

@Global()
@Module({
  imports: [TwoFactorModule, TransferModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, SupabaseAuthGuard],
  exports: [AuthService, SupabaseAuthGuard, TransferModule],
})
export class AuthModule {}
