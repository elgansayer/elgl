import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Delete,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UserProfile,
  ProfileVisitor,
} from './interfaces/user-profile.interface';
import { UsersService } from './users.service';
import { MediaService } from '../media/media.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mediaService: MediaService,
  ) {}

  @Delete('me')
  async deleteMyAccount(
    @CurrentUser() user: User | null,
  ): Promise<{ message: string; scheduled_for_deletion_at: string }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.scheduleDeletion(user.id);
  }

  @Post('me/restore')
  async restoreMyAccount(
    @CurrentUser() user: User | null,
  ): Promise<{ message: string }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.cancelDeletion(user.id);
  }

  @Get('me/export')
  async exportMyData(
    @CurrentUser() user: User | null,
  ): Promise<Record<string, unknown>> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.exportUserData(user.id);
  }

  @Get('me')
  async getMyProfile(
    @CurrentUser() user: User | null,
  ): Promise<UserProfile | null> {
    if (!user) return null;
    return this.usersService.getProfile(user.id);
  }

  @Get('me/stats')
  async getMyStats(
    @CurrentUser() user: User | null,
  ): Promise<Partial<UserProfile>> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getUserStats(user.id);
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
      { cover_photo_url: coverPhotoUrl },
      profile?.is_vip ?? false,
    );
  }

  @Post('me/avatar/presigned-url')
  async getAvatarPresignedUrl(
    @CurrentUser() user: User | null,
    @Body() dto: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; mediaUrl: string; objectKey: string }> {
    if (!user) throw new UnauthorizedException();
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP images are allowed',
      );
    }
    return this.mediaService.generatePresignedUrl(user.id, {
      filename: dto.filename,
      contentType: dto.contentType,
      folder: 'avatars',
    });
  }

  @Get('me/visitors')
  async getMyVisitors(
    @CurrentUser() user: User | null,
  ): Promise<ProfileVisitor[]> {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.usersService.getVisitors(user.id);
  }

  @Get(':id')
  async getUserProfile(@Param('id') id: string): Promise<UserProfile> {
    return this.usersService.getProfile(id);
  }

  @Get(':id/stats')
  async getUserStats(@Param('id') id: string): Promise<Partial<UserProfile>> {
    return this.usersService.getUserStats(id);
  }

  @Get('me/privacy-settings')
  async getMyPrivacySettings(@CurrentUser() user: User | null): Promise<{
    privacy_hide_age: boolean;
    privacy_hide_location: boolean;
    privacy_hide_from_search: boolean;
    privacy_hide_gender: boolean;
  }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getPrivacySettings(user.id);
  }

  @Get('me/message-filters')
  async getMyMessageFilters(@CurrentUser() user: User | null): Promise<{
    ageMin?: number;
    ageMax?: number;
    allowedNativeLanguages?: string[];
  }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getMessageFilters(user.id);
  }

  @Put('me/message-filters')
  async setMyMessageFilters(
    @CurrentUser() user: User | null,
    @Body()
    filters: {
      ageMin?: number;
      ageMax?: number;
      allowedNativeLanguages?: string[];
    },
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    await this.usersService.setMessageFilters(user.id, filters);
  }
}
