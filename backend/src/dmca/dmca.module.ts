import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminDmcaV1Controller } from './admin-dmca-v1.controller';
import { DmcaMaintenanceService } from './dmca-maintenance.service';
import { DmcaMediaService } from './dmca-media.service';
import { DmcaOperatorService } from './dmca-operator.service';
import { DmcaController } from './dmca.controller';
import { DmcaService } from './dmca.service';

/**
 * EmailModule and MetricsModule are global. AdminModule supplies the admin
 * guards; AuthModule (global) supplies SupabaseAuthGuard.
 */
@Module({
  imports: [SupabaseModule, AdminModule, CloudflareR2Module],
  controllers: [DmcaController, AdminDmcaV1Controller],
  providers: [
    DmcaService,
    DmcaOperatorService,
    DmcaMaintenanceService,
    DmcaMediaService,
  ],
  exports: [DmcaService],
})
export class DmcaModule {}
