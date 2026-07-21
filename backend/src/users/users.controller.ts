import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfile } from './interfaces/user-profile.interface';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMyProfile(
    @CurrentUser() user: User | null,
  ): Promise<UserProfile | null> {
    if (!user) return null;
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return this.usersService.updateProfile(
      user.id,
      dto,
      profile?.is_vip ?? false,
    );
  }

  @Get(':id')
  async getUserProfile(@Param('id') id: string): Promise<UserProfile> {
    return this.usersService.getProfile(id);
  }
}
