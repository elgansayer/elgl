import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { MonitoringService } from './monitoring.service';
import {
  ModerationQueueMetrics,
  AdminDashboardMetrics,
} from './monitoring.interfaces';

@Controller('monitoring')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('moderation-queue')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getModerationQueue(): Promise<ModerationQueueMetrics> {
    return this.monitoringService.collectModerationQueueMetrics();
  }

  @Get('admin-dashboard')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getAdminDashboard(): Promise<AdminDashboardMetrics> {
    return this.monitoringService.collectAdminDashboardMetrics();
  }
}