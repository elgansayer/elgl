import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LessonsModule } from '../lessons/lessons.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminAuditQueryService } from './admin-audit-query.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminController } from './admin.controller';
import { AdminLoginHistoryQueryService } from './admin-login-history-query.service';
import { AdminModerationQueryService } from './admin-moderation-query.service';
import { AdminMutationAuditInterceptor } from './admin-mutation-audit.interceptor';
import { AdminNetworkAbuseV1Controller } from './admin-network-abuse-v1.controller';
import { AdminNetworkAbuseService } from './admin-network-abuse.service';
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
import { NetworkAbuseGuard } from './guards/network-abuse.guard';

@Module({
  imports: [SupabaseModule, forwardRef(() => LessonsModule), PrivacyModule],
  controllers: [
    AdminController,
    AdminV1Controller,
    AdminRolesV1Controller,
    AdminOperationalEventsV1Controller,
    AdminNetworkAbuseV1Controller,
  ],
  providers: [
    AdminService,
    AdminAuthorizationService,
    AdminAuditService,
    AdminAuditQueryService,
    AdminLoginHistoryQueryService,
    AdminModerationQueryService,
    AdminNetworkAbuseService,
    AdminOperationalEventsService,
    AdminRoleAssignmentsService,
    AdminRoleInventoryService,
    AdminSystemHealthService,
    AdminUserDetailService,
    AdminGuard,
    AdminCapabilityGuard,
    NetworkAbuseGuard,
    AdminMutationAuditInterceptor,
    {
      provide: APP_GUARD,
      useExisting: NetworkAbuseGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: AdminMutationAuditInterceptor,
    },
  ],
  exports: [
    AdminAuthorizationService,
    AdminAuditService,
    AdminGuard,
    AdminCapabilityGuard,
  ],
})
export class AdminModule {}
