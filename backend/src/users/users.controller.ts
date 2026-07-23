import { Body, Controller, Get, Param, Patch, Post, UseGuards, UnauthorizedException } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfile } from './interfaces/user-profile.interface';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mediaService: MediaService,
  ) {}

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

  @Post('me/cover-photo/presigned-url')
  async getCoverPhotoPresignedUrl(
    @CurrentUser() user: User | null,
    @Body() dto: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    if (!user) throw new Error('User not authenticated');
    return this.mediaService.generatePresignedUrl(user.id, {
      filename: dto.filename,
      contentType: dto.contentType,
      folder: 'cover-photos',
    });
  }

  @Patch('me/cover-photo')
  async updateCoverPhoto(
    @CurrentUser() user: User | null,
    @Body('cover_photo_url') coverPhotoUrl: string,
  ): Promise<UserProfile | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return this.usersService.updateProfile(
      user.id,
      { cover_photo_url: coverPhotoUrl },
      profile?.is_vip ?? false,
    );
  }

  @Post('me/cover-photo/presigned-url')
  async getCoverPhotoPresignedUrl(
    @CurrentUser() user: User | null,
    @Body() dto: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    if (!user) throw new UnauthorizedException();
    return this.mediaService.generatePresignedUrl(user.id, {
      filename: dto.filename,
      contentType: dto.contentType,
      folder: 'cover-photos',
    });
  }

  @Patch('me/cover-photo')
  async updateCoverPhoto(
    @CurrentUser() user: User | null,
    @Body('cover_photo_url') coverPhotoUrl: string,
  ): Promise<UserProfile | null> {
    if (!user) return null;
    const profile = await this.usersService.getProfile(user.id);
    return this.usersService.updateProfile(
      user.id,
      { cover_photo_url: coverPhotoUrl } as UpdateProfileDto,
      profile?.is_vip ?? false,
    );
  }

  @Get(':id')
  async getUserProfile(@Param('id') id: string): Promise<UserProfile> {
    return this.usersService.getProfile(id);
  }
}
