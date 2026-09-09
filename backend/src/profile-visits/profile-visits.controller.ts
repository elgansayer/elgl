import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from '../users/users.service';
import {
  ProfileVisitRecord,
  ProfileVisitsService,
} from './profile-visits.service';

@Controller('profile-visits')
@UseGuards(SupabaseAuthGuard)
export class ProfileVisitsController {
  constructor(
    private readonly profileVisitsService: ProfileVisitsService,
    private readonly usersService: UsersService,
  ) {}

  @Post(':viewedId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async recordVisit(
    @CurrentUser() user: User | null,
    @Param('viewedId') viewedId: string,
  ): Promise<Record<string, unknown> | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return this.profileVisitsService.recordVisit(
      user.id,
      viewedId,
      profile?.is_vip ?? false,
    );
  }

  @Get('my-visitors')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  async getMyVisitors(
    @CurrentUser() user: User | null,
  ): Promise<ProfileVisitRecord[]> {
    if (!user) return [];
    const profile = await this.usersService.getProfile(user.id);
    return this.profileVisitsService.getVisitors(
      user.id,
      profile?.is_vip ?? false,
    );
  }
}
