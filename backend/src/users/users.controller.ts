import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Delete,
  Query,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TwoFactorGuard } from '../two-factor/two-factor.guard';
import { MessageFiltersDto, UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';
import { PrivacySettingsDto } from './dto/privacy-settings.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { UpdateGreetingMessageDto } from './dto/update-greeting-message.dto';
import { UpdateAwayMessageDto } from './dto/update-away-message.dto';
import { UpdateStatusVisibilityDto } from './dto/update-status-visibility.dto';
import { DoNotDisturbDto } from './dto/do-not-disturb.dto';
import {
  UserProfile,
  ProfileVisitor,
  BusinessCatalogItem,
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

  private parsePaginationInteger(
    value: string | number | undefined,
    name: 'limit' | 'offset',
    defaultValue: number,
    minimum: number,
    maximum?: number,
  ): number {
    if (value === undefined || value === '') return defaultValue;

    const parsed =
      typeof value === 'number'
        ? value
        : /^\d+$/.test(value)
          ? Number(value)
          : Number.NaN;
    const outsideRange =
      parsed < minimum || (maximum !== undefined && parsed > maximum);
    if (!Number.isSafeInteger(parsed) || outsideRange) {
      const range =
        maximum === undefined
          ? `at least ${minimum}`
          : `between ${minimum} and ${maximum}`;
      throw new BadRequestException(`${name} must be an integer ${range}`);
    }

    return parsed;
  }

  @UseGuards(TwoFactorGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Delete('me')
  async deleteMyAccount(
    @CurrentUser() user: User | null,
  ): Promise<{ message: string; scheduled_for_deletion_at: string }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.scheduleDeletion(user.id);
  }

  @UseGuards(TwoFactorGuard)
  @Throttle({ default: { limit: 2, ttl: 300000 } })
  @Delete('me/permanent')
  async permanentlyDeleteMyAccount(
    @CurrentUser() user: User | null,
  ): Promise<{ message: string }> {
    if (!user) throw new UnauthorizedException();
    await this.usersService.permanentDeleteAccount(user.id);
    return { message: 'Account permanently deleted.' };
  }

  @UseGuards(TwoFactorGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
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

  @Get('me/notification-preferences')
  async getMyNotificationPreferences(
    @CurrentUser() user: User | null,
  ): Promise<{
    custom_tone_url?: string;
    vibration_pattern?: number[];
  } | null> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getNotificationPreferences(user.id);
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

  @Get('me/xp')
  async getMyXp(
    @CurrentUser() user: User | null,
  ): Promise<{ totalXp: number }> {
    if (!user) throw new UnauthorizedException();
    const totalXp = await this.usersService.getUserXp(user.id);
    return { totalXp };
  }

  @Post('me/assess-proficiency')
  async assessProficiency(
    @CurrentUser() user: User | null,
    @Body('score') score: number,
  ): Promise<{ level: string }> {
    if (!user) throw new UnauthorizedException();
    if (typeof score !== 'number' || score < 0 || score > 100) {
      throw new BadRequestException();
    }
    const level = await this.usersService.proficiencyAssessment(user.id, score);
    return { level };
  }

  @UseGuards(TwoFactorGuard)
  @Patch('me')
  async updateMyProfile(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile | null> {
    if (!user) return null;
    return this.usersService.updateProfile(
      user.id,
      dto,
      Boolean((await this.usersService.getProfile(user.id))?.is_vip ?? false),
    );
  }

  @Patch('me/greeting')
  async updateGreetingMessage(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateGreetingMessageDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.updateGreetingMessage(
      user.id,
      dto.greetingMessage,
    );
  }

  @Patch('me/away')
  async updateAwayMessage(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateAwayMessageDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.updateAwayMessage(user.id, dto.awayMessage);
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
    return this.usersService.updateProfile(
      user.id,
      { cover_photo_url: coverPhotoUrl },
      Boolean((await this.usersService.getProfile(user.id))?.is_vip ?? false),
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
      throw new BadRequestException();
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

  @Get('status/:statusId/viewers')
  async getStatusViewers(
    @CurrentUser() user: User | null,
    @Param('statusId') statusId: string,
  ): Promise<ProfileVisitor[]> {
    if (!user) {
      throw new UnauthorizedException();
    }
    return await this.usersService.getStatusViewersByStatusId(
      user.id,
      statusId,
    );
  }

  @Get('me/status-viewers')
  async getMyStatusViewers(
    @CurrentUser() user: User | null,
  ): Promise<ProfileVisitor[]> {
    if (!user) {
      throw new UnauthorizedException();
    }
    const userId = String(user.id);
    const defaultStatusId: string =
      await this.usersService.getDefaultStatusId(userId);
    return await this.usersService.getStatusViewersByStatusId(
      userId,
      defaultStatusId,
    );
  }

  @Get('hobbies')
  getAvailableHobbies(): string[] {
    return this.usersService.getAvailableHobbies();
  }

  @Get('interests')
  getAvailableInterests(): string[] {
    return this.usersService.getAvailableInterests();
  }

  @Get('search')
  async searchUsers(
    @Query('q') query: string,
    @CurrentUser() user: User | null,
    @Query('limit') limit: string | number | undefined,
  ): Promise<
    { id: string; display_name: string; avatar_url: string | null }[]
  > {
    if (!user) throw new UnauthorizedException();
    if (!query || query.trim().length === 0) return [];
    const boundedLimit = this.parsePaginationInteger(
      limit,
      'limit',
      10,
      1,
      100,
    );
    return this.usersService.searchUsers(query.trim(), user.id, boundedLimit);
  }

  @Get('me/badges')
  async getMyBadges(
    @CurrentUser() user: User | null,
  ): Promise<{ id: string; name: string; description: string }[]> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getBadges(user.id);
  }

  @Get(':id')
  async getUserProfile(
    @Param('id') id: string,
    @CurrentUser() currentUser: User | null,
  ): Promise<UserProfile> {
    const profile = await this.usersService.getProfile(id);

    // Enforce profile visibility
    if (id !== (currentUser?.id ?? '')) {
      const profileRecord = profile as unknown as Record<string, unknown>;
      const visibility =
        (profileRecord.profile_visibility as string) ?? 'everyone';
      if (visibility === 'hidden') {
        throw new UnauthorizedException('This profile is not visible');
      }
      if (visibility === 'vips_only') {
        const isRequestingVip = Boolean(
          currentUser
            ? ((await this.usersService.getProfile(currentUser.id))?.is_vip ??
                false)
            : false,
        );
        if (!isRequestingVip) {
          throw new UnauthorizedException(
            'This profile is visible to VIP members only',
          );
        }
      }
    }

    return profile;
  }

  @Get(':id/stats')
  async getUserStats(@Param('id') id: string): Promise<Partial<UserProfile>> {
    return this.usersService.getUserStats(id);
  }

  @Get(':id/followers')
  async getFollowers(
    @Param('id') id: string,
    @Query('limit') limit: string | number | undefined,
    @Query('offset') offset: string | number | undefined,
    @CurrentUser() user: User | null,
  ): Promise<{ data: UserProfile[]; total: number }> {
    const boundedLimit = this.parsePaginationInteger(
      limit,
      'limit',
      20,
      1,
      100,
    );
    const boundedOffset = this.parsePaginationInteger(
      offset,
      'offset',
      0,
      0,
      10_000,
    );
    return this.usersService.getFollowers(
      id,
      boundedLimit,
      boundedOffset,
      user?.id,
    );
  }

  @Get(':id/following')
  async getFollowing(
    @Param('id') id: string,
    @Query('limit') limit: string | number | undefined,
    @Query('offset') offset: string | number | undefined,
    @CurrentUser() user: User | null,
  ): Promise<{ data: UserProfile[]; total: number }> {
    const boundedLimit = this.parsePaginationInteger(
      limit,
      'limit',
      20,
      1,
      100,
    );
    const boundedOffset = this.parsePaginationInteger(
      offset,
      'offset',
      0,
      0,
      10_000,
    );
    return this.usersService.getFollowing(
      id,
      boundedLimit,
      boundedOffset,
      user?.id,
    );
  }

  @Post(':id/follow')
  async followUser(
    @Param('id') id: string,
    @CurrentUser() user: User | null,
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.followUser(user.id, id);
  }

  @Delete(':id/follow')
  async unfollowUser(
    @Param('id') id: string,
    @CurrentUser() user: User | null,
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.unfollowUser(user.id, id);
  }

  @Post('block/:id')
  async blockUser(
    @CurrentUser() user: User | null,
    @Param('id') targetId: string,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    if (user.id === targetId)
      throw new BadRequestException('Cannot block yourself');
    return this.usersService.blockUser(user.id, targetId);
  }

  @Delete('block/:id')
  async unblockUser(
    @CurrentUser() user: User | null,
    @Param('id') targetId: string,
  ): Promise<{ success: boolean }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.unblockUser(user.id, targetId);
  }

  @Post('report')
  async reportUser(
    @CurrentUser() user: User | null,
    @Body()
    dto: {
      reported_id: string;
      reason_category: string;
      description?: string;
      context_url?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    if (!user) throw new UnauthorizedException();
    if (!dto.reported_id || !dto.reason_category)
      throw new BadRequestException();
    return this.usersService.reportUser(user.id, {
      reported_id: String(dto.reported_id),
      reason_category: String(dto.reason_category),
      description: dto.description ? String(dto.description) : undefined,
      context_url: dto.context_url ? String(dto.context_url) : undefined,
    });
  }

  @Get('me/privacy-settings')
  async getMyPrivacySettings(@CurrentUser() user: User | null): Promise<{
    privacy_hide_age: boolean;
    privacy_hide_location: boolean;
    privacy_hide_from_search: boolean;
    privacy_hide_gender: boolean;
    privacy_last_seen?: string;
    privacy_profile_photo?: string;
    privacy_about_info?: string;
    privacy_status?: string;
    incognito_visits?: boolean;
    profile_visibility?: 'everyone' | 'vips_only' | 'hidden';
  }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getPrivacySettings(user.id);
  }

  @Get('me/message-filters')
  async getMyMessageFilters(
    @CurrentUser() user: User | null,
  ): Promise<MessageFiltersDto> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getMessageFilters(user.id);
  }

  @Put('me/message-filters')
  async setMyMessageFilters(
    @CurrentUser() user: User | null,
    @Body() filters: MessageFiltersDto,
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    await this.usersService.setMessageFilters(user.id, filters);
  }

  @Patch('me/privacy')
  async updatePrivacySettings(
    @CurrentUser() user: User | null,
    @Body() dto: PrivacySettingsDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    const isVip = Boolean(
      (await this.usersService.getProfile(user.id))?.is_vip ?? false,
    );
    return this.usersService.updatePrivacySettings(user.id, dto, isVip);
  }

  @Get('me/business')
  async getMyBusinessProfile(@CurrentUser() user: User | null): Promise<{
    business_name?: string;
    business_hours?: string;
    website_url?: string;
    catalog?: BusinessCatalogItem[];
  }> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.getBusinessProfile(user.id);
  }

  @Patch('me/business')
  async updateMyBusinessProfile(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.updateBusinessProfile(user.id, dto);
  }

  @Patch('me/dnd')
  async setDoNotDisturb(
    @CurrentUser() user: User | null,
    @Body() dto: DoNotDisturbDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.updateDoNotDisturbSettings(user.id, dto);
  }

  @Patch('me/status-visibility')
  async updateStatusVisibility(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateStatusVisibilityDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    const isVip = Boolean(
      (await this.usersService.getProfile(user.id))?.is_vip ?? false,
    );
    return this.usersService.updatePrivacySettings(
      user.id,
      { status_visibility: dto.status_visibility },
      isVip,
    );
  }

  @Post('me/contact-sharing')
  async shareContact(
    @CurrentUser() user: User | null,
    @Body('target_user_id') targetUserId: string,
  ): Promise<{ phone_number?: string; email?: string }> {
    if (!user) throw new UnauthorizedException();
    if (!targetUserId)
      throw new BadRequestException('Target user ID is required');
    return this.usersService.shareContact(user.id, targetUserId);
  }

  @Patch('me/notification-preferences')
  async updateNotificationPreferences(
    @CurrentUser() user: User | null,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<UserProfile | null> {
    if (!user) throw new UnauthorizedException();
    return this.usersService.updateNotificationPreferences(user.id, dto);
  }
}
