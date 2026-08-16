import { forwardRef, Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminAuditQueryService } from './admin-audit-query.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminController } from './admin.controller';
import { AdminModerationQueryService } from './admin-moderation-query.service';
import { AdminOperationalEventsV1Controller } from './admin-operational-events-v1.controller';
import { AdminOperationalEventsService } from './admin-operational-events.service';
import { AdminRoleAssignmentsService } from './admin-role-assignments.service';
import { AdminRoleInventoryService } from './admin-role-inventory.service';
import { AdminRolesV1Controller } from './admin-roles-v1.controller';
import { AdminService } from './admin.service';
import { AdminSystemHealthService } from './admin-system-health.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { AdminV1Controller } from './admin-v1.controller';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [SupabaseModule, forwardRef(() => LessonsModule), PrivacyModule],
  controllers: [
    AdminController,
    AdminV1Controller,
    AdminRolesV1Controller,
    AdminOperationalEventsV1Controller,
  ],
  providers: [
    AdminService,
    AdminAuthorizationService,
    AdminAuditService,
    AdminAuditQueryService,
    AdminModerationQueryService,
    AdminOperationalEventsService,
    AdminRoleAssignmentsService,
    AdminRoleInventoryService,
    AdminSystemHealthService,
    AdminUserDetailService,
    AdminGuard,
    AdminCapabilityGuard,
  ],
  exports: [
    AdminAuthorizationService,
    AdminAuditService,
    AdminGuard,
    AdminCapabilityGuard,
  ],
})
export class AdminModule {}
