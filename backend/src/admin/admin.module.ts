import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
