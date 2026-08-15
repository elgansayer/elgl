import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { LessonsModule } from '../lessons/lessons.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { AdminController } from './admin.controller';
import { AdminV1Controller } from './admin-v1.controller';
import { AdminService } from './admin.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditQueryService } from './admin-audit-query.service';
import { AdminSystemHealthService } from './admin-system-health.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { AdminGuard } from './guards/admin.guard';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';

@Module({
  imports: [SupabaseModule, LessonsModule, PrivacyModule],
  controllers: [AdminController, AdminV1Controller],
  providers: [
    AdminService,
    AdminAuthorizationService,
    AdminAuditService,
    AdminAuditQueryService,
    AdminSystemHealthService,
    AdminUserDetailService,
    AdminGuard,
    AdminCapabilityGuard,
  ],
  exports: [
    AdminAuthorizationService,
    AdminAuditService,
    AdminCapabilityGuard,
  ],
})
export class AdminModule {}
