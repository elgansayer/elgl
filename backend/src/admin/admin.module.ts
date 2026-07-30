import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { LessonsController } from '../lessons/lessons.controller';
import { LessonsService } from '../lessons/lessons.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AdminController, LessonsController],
  providers: [AdminService, AdminGuard, LessonsService],
})
export class AdminModule {}
