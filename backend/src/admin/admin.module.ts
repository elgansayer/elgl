import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { LessonsModule } from '../lessons/lessons.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [SupabaseModule, LessonsModule, PrivacyModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
