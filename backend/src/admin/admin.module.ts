import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { LessonsModule } from '../lessons/lessons.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { AdminController } from './admin.controller';
import { AdminV1Controller } from './admin-v1.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [SupabaseModule, LessonsModule, PrivacyModule],
  controllers: [AdminController, AdminV1Controller],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
