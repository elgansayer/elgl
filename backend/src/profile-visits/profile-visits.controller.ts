import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  ProfileVisitorsPage,
  ProfileVisitsService,
  RecordProfileVisitResult,
} from './profile-visits.service';

@Controller('profile-visits')
@UseGuards(SupabaseAuthGuard)
export class ProfileVisitsController {
  constructor(private readonly profileVisitsService: ProfileVisitsService) {}

  @Post(':viewedId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async recordVisit(
    @CurrentUser() user: User | null,
    @Param('viewedId') viewedId: string,
  ): Promise<RecordProfileVisitResult> {
    if (!user) throw new UnauthorizedException();
    return this.profileVisitsService.recordVisit(user.id, viewedId);
  }

  @Get('my-visitors')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  async getMyVisitors(
    @CurrentUser() user: User | null,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<ProfileVisitorsPage> {
    if (!user) throw new UnauthorizedException();
    return this.profileVisitsService.getVisitors(user.id, limit, offset);
  }

  @Get('count')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'private, no-store')
  async getVisitCount(
    @CurrentUser() user: User | null,
  ): Promise<{ count: number }> {
    if (!user) throw new UnauthorizedException();
    const count = await this.profileVisitsService.getVisitCount(user.id);
    return { count };
  }
}
