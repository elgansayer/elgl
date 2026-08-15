import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { LessonsModule } from '../lessons/lessons.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { AdminController } from './admin.controller';
import { AdminV1Controller } from './admin-v1.controller';
import { AdminService } from './admin.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { AdminGuard } from './guards/admin.guard';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';

@Module({
  imports: [SupabaseModule, LessonsModule, PrivacyModule],
  controllers: [AdminController, AdminV1Controller],
  providers: [
    AdminService,
    AdminAuthorizationService,
    AdminUserDetailService,
    AdminGuard,
    AdminCapabilityGuard,
  ],
  exports: [AdminAuthorizationService, AdminCapabilityGuard],
})
export class AdminModule {}
