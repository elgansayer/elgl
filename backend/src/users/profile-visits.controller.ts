import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProfileVisitor } from './interfaces/user-profile.interface';
import { ProfileVisitsService } from './profile-visits.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class ProfileVisitsController {
  constructor(private readonly profileVisitsService: ProfileVisitsService) {}

  @Get(':id/visitors')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getVisitors(
    @Param('id') id: string,
    @CurrentUser() user: User | null,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<ProfileVisitor[]> {
    if (!user) throw new UnauthorizedException();
    if (limit < 1 || offset < 0) {
      throw new BadRequestException(
        'Visitor pagination requires limit >= 1 and offset >= 0',
      );
    }

    return this.profileVisitsService.getVisitors(id, user.id, limit, offset);
  }
}
