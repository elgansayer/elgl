import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';
import {
  UserProfile,
  ProfileVisitor,
  ProfileVisitorSummary,
  BusinessCatalogItem,
} from './interfaces/user-profile.interface';

import { Optional } from '@nestjs/common';
import { CorrectorScoreService } from '../corrector-score/corrector-score.service';
import { NotificationsService } from '../notifications/notifications.service';
import { XpService } from '../xp/xp.service';
import { PREDEFINED_HOBBIES, PREDEFINED_INTERESTS } from './constants';
import { DoNotDisturbDto } from './dto/do-not-disturb.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { DataExportWorker } from './data-export.worker';

@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly xpService: XpService,
    private readonly dataExportWorker: DataExportWorker,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly correctorScoreService?: CorrectorScoreService,
  ) {}

  async proficiencyAssessment(userId: string, score: number): Promise<string> {
    // Simple score‑based mapping to CEFR levels
    let level: string;
    if (score >= 90) {
      level = 'C2';
    } else if (score >= 75) {
      level = 'C1';
    } else if (score >= 60) {
      level = 'B2';
    } else if (score >= 45) {
      level = 'B1';
    } else if (score >= 30) {
      level = 'A2';
    } else {
      level = 'A1';
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ proficiency_level: level } as never)
      .eq('id', userId);

    if (error) {
      Logger.warn(
        `Failed to update proficiency_level for ${userId}: ${error.message}`,
      );
    }

    return level;
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (response.error || !response.data) {
      return this.getMockProfile(userId);
    }

    const profile = response.data as UserProfile;

    // Fetch related profile data concurrently to improve performance
    const [scoreRes, fcRes, fngRes, xpTotal] = await Promise.all([
      this.correctorScoreService
        ? this.correctorScoreService.getCorrectorScore(userId)
        : Promise.resolve({ averageScore: 0 }),
      (async () => {
        try {
          return await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId);
        } catch {
          return { count: 0 };
        }
      })(),
      (async () => {
        try {
          return await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId);
        } catch {
          return { count: 0 };
        }
      })(),
      this.xpService.getTotalXp(userId),
    ]);

    profile.corrector_score = scoreRes?.averageScore ?? 0;
    profile.followers_count = fcRes?.count ?? 0;
    profile.following_count = fngRes?.count ?? 0;
    profile.xp_total = xpTotal;

    return profile;
  }

  async searchUsers(
    query: string,
    currentUserId: string,
    limit = 10,
  ): Promise<
    { id: string; display_name: string; avatar_url: string | null }[]
  > {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `${query}%`)
      .neq('id', currentUserId)
      .order('display_name', { ascending: true })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data as {
      id: string;
      display_name: string;
      avatar_url: string | null;
    }[];
  }

  async getUserXp(userId: string): Promise<number> {
    return this.xpService.getTotalXp(userId);
  }

  async getVisitors(userId: string): Promise<ProfileVisitor[]> {
    const supabase = this.supabaseService.getClient();

    const response = (await supabase
      .from('profile_visits')
      .select(
        `
        id,
        visitor_id,
        viewed_id,
        created_at,
        visitor:visitor_id (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('viewed_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)) as unknown as { data: any[]; error: any };

    if (response.error) {
      throw new InternalServerErrorException('Failed to fetch visitors');
    }

    const rawData = response.data ?? [];
    if (!Array.isArray(rawData)) {
      throw new InternalServerErrorException('Unexpected response shape');
    }
    const rows = rawData as unknown as Array<{
      id: string;
      visitor_id: string;
      viewed_id: string;
      created_at: string;
      visitor: ProfileVisitorSummary | ProfileVisitorSummary[] | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      visitor_id: row.visitor_id,
      viewed_id: row.viewed_id,
      created_at: row.created_at,
      visitor: Array.isArray(row.visitor)
        ? (row.visitor[0] ?? undefined)
        : (row.visitor ?? undefined),
    }));
  }

  async getStatusViewersByStatusId(
    userId: string,
    statusId: string,
  ): Promise<ProfileVisitor[]> {
    const supabase = this.supabaseService.getClient();

    const response = await supabase
      .from('status_views')
      .select(
        `
        id,
        viewer_id,
        status_owner_id,
        created_at,
        viewer:viewer_id (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('status_owner_id', userId)
      .eq('status_id' as never, statusId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (response.error) {
      throw new InternalServerErrorException('Failed to fetch status viewers');
    }

    const rawData = response.data ?? [];
    if (!Array.isArray(rawData)) {
      throw new InternalServerErrorException('Unexpected response shape');
    }
    const rows = rawData as unknown as Array<{
      id: string;
      viewer_id: string;
      status_owner_id: string;
      created_at: string;
      viewer: ProfileVisitorSummary | ProfileVisitorSummary[] | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      visitor_id: row.viewer_id,
      viewed_id: row.status_owner_id,
      created_at: row.created_at,
      visitor: Array.isArray(row.viewer)
        ? (row.viewer[0] ?? undefined)
        : (row.viewer ?? undefined),
    }));
  }

  getDefaultStatusId(userId: string): Promise<string> {
    // No dedicated statuses table exists: each user has a single current
    // status (profile.status_text), so the status id is the user's own id.
    return Promise.resolve(userId);
  }

  async followUser(followerId: string, targetUserId: string): Promise<void> {
    if (followerId === targetUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_follows')
      .upsert(
        { follower_id: followerId, following_id: targetUserId },
        { onConflict: 'follower_id,following_id' },
      );

    if (error) {
      Logger.warn(
        `Failed to follow user ${targetUserId} by ${followerId}: ${error.message}`,
      );
    } else if (this.notificationsService) {
      void this.notificationsService.createNotification(
        targetUserId,
        followerId,
        'follow',
      );
    }
  }

  async unfollowUser(followerId: string, targetUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', targetUserId);

    if (error) {
      Logger.warn(
        `Failed to unfollow user ${targetUserId} by ${followerId}: ${error.message}`,
      );
    }
  }

  async likeProfile(likerId: string, targetUserId: string): Promise<void> {
    if (likerId === targetUserId) {
      throw new BadRequestException('Cannot like your own profile');
    }
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_profile_likes')
      .upsert(
        { liker_id: likerId, liked_id: targetUserId },
        { onConflict: 'liker_id,liked_id' },
      );

    if (error) {
      Logger.warn(
        `Failed to like profile ${targetUserId} by ${likerId}: ${error.message}`,
      );
    } else if (this.notificationsService) {
      void this.notificationsService.createNotification(
        targetUserId,
        likerId,
        'like_profile',
      );
    }
  }

  async unlikeProfile(likerId: string, targetUserId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_profile_likes')
      .delete()
      .eq('liker_id', likerId)
      .eq('liked_id', targetUserId);

    if (error) {
      Logger.warn(
        `Failed to unlike profile ${targetUserId} by ${likerId}: ${error.message}`,
      );
    }
  }

  async touchLastActiveAt(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('users')
      .update({ last_active_at: now } as never)
      .eq('id', userId);

    if (error) {
      Logger.warn(
        `Failed to update last_active_at for user ${userId}: ${error?.message ?? 'Unknown error'}`,
      );
    }
  }

  async getNotificationPreferences(userId: string): Promise<{
    custom_tone_url?: string;
    vibration_pattern?: number[];
  }> {
    const profile = await this.getProfile(userId);
    return profile.notification_preferences ?? {};
  }

  async updateDoNotDisturbSettings(
    userId: string,
    dto: DoNotDisturbDto,
  ): Promise<UserProfile> {
    const supabase = this.supabaseService.getClient();
    const updatePayload: Record<string, unknown> = {};
    if (dto.do_not_disturb !== undefined)
      updatePayload.do_not_disturb = dto.do_not_disturb;
    if (dto.quiet_hours_start !== undefined)
      updatePayload.quiet_hours_start = dto.quiet_hours_start;
    if (dto.quiet_hours_end !== undefined)
      updatePayload.quiet_hours_end = dto.quiet_hours_end;
    const { error: dndUpdateError } = await supabase
      .from('users')
      .update(updatePayload as never)
      .eq('id', userId);
    if (dndUpdateError) {
      Logger.warn(`DND update failed, falling back: ${dndUpdateError.message}`);
      const mock = this.getMockProfile(userId);
      return { ...mock, ...updatePayload };
    }
    return this.getProfile(userId);
  }

  private getMockProfile(userId: string): UserProfile {
    return {
      id: userId,
      display_name: 'My Profile (Mock)',
      native_languages: ['en'],
      target_languages: ['es', 'ja'],
      bio_text: 'This is my mock profile. I love learning languages!',
      proficiency_level: 'B1',
      status_text: 'Learning new languages!',
      avatar_url: `https://i.pravatar.cc/150?u=${userId}`,
      audio_intro_url: undefined,
      cover_photo_url: undefined,
      interests: ['tech', 'travel', 'movies'],
      is_vip: true,
      vip_tier: 'premium',
      coins_balance: 500,
      auto_play_voice_notes: false,
      chat_enter_to_send: false,
      chat_text_size: 'medium',
      study_streak_days: 15,
      correction_ratio: 0.95,
      is_serious_learner: true,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      matchmaking_consent: false,
      privacy_hide_gender: false,
      privacy_hide_exact_location: false,
      privacy_hide_online_status: false,
      privacy_hide_vip_status: false,
      silence_unknown_callers: false,
      auto_download_media: false,
      auto_download_wifi_only: false,
      auto_download_preference: 'wifi',
      status_visibility: 'public',
      corrector_score: 0,
      incognito_visits: false,
      created_at: new Date().toISOString(),
      scheduled_for_deletion_at: undefined,
      mock_country: undefined,
      mock_city: undefined,
      notification_preferences: undefined,
      xp_total: 100,
      business_name: 'My Mock Shop',
      business_hours: 'Mon-Fri 9AM-5PM',
      website_url: 'https://mock.shop',
      catalog: [],
      greeting_message: 'Hello! I am happy to practice languages with you.',
      away_message: 'I am away right now. I will reply later.',
      followers_count: 0,
      following_count: 0,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    isVip: boolean,
  ): Promise<UserProfile> {
    if (dto.target_languages && dto.target_languages.length > 1 && !isVip) {
      throw new BadRequestException(
        'Free tier allows a maximum of 1 target language. Upgrade to VIP (8 UKP / $10 USD per month) to study up to 3 languages, or Pro (12 UKP / $15 USD per month) for up to 5 languages.',
      );
    }

    if (dto.target_languages && dto.target_languages.length > 3) {
      const currentProfile = await this.getProfile(userId);
      const tier = currentProfile?.vip_tier ?? 'free';
      const maxLanguages = tier === 'pro' || tier === 'developer' ? 5 : 3;
      if (dto.target_languages.length > maxLanguages) {
        throw new BadRequestException(
          `A maximum of ${maxLanguages} target languages can be studied simultaneously on your current tier.`,
        );
      }
    }

    // Location spoofing is a consumer VIP benefit. A free user must not be
    // able to set spoofed coordinates, city, country, or enable the spoofing
    // toggle itself. Disabling the toggle (false) stays allowed for everyone.
    const setsSpoofedLocation =
      dto.mock_location !== undefined ||
      dto.mock_country !== undefined ||
      dto.mock_city !== undefined ||
      dto.enable_location_spoofing === true;
    if (setsSpoofedLocation && !isVip) {
      throw new BadRequestException(
        'Location spoofing requires a VIP subscription (8 UKP / $10 USD per month).',
      );
    }

    // Build fix: declare before use to satisfy TS2448
    const updatePayload: Record<string, unknown> = {};

    if (dto.primary_accent_color !== undefined) {
      if (!isVip) {
        throw new BadRequestException(
          'Custom primary accent colours require a VIP subscription (8 UKP / $10 USD per month).',
        );
      }
      updatePayload.primary_accent_color = dto.primary_accent_color;
    }

    if (dto.enable_location_spoofing !== undefined) {
      updatePayload.enable_location_spoofing = dto.enable_location_spoofing;
    }

    if (dto.display_name !== undefined)
      updatePayload.display_name = dto.display_name;
    if (dto.native_languages !== undefined)
      updatePayload.native_languages = dto.native_languages;
    if (dto.target_languages !== undefined)
      updatePayload.target_languages = dto.target_languages;
    if (dto.bio_text !== undefined) updatePayload.bio_text = dto.bio_text;
    if (dto.avatar_url !== undefined) updatePayload.avatar_url = dto.avatar_url;
    if (dto.audio_intro_url !== undefined)
      updatePayload.audio_intro_url = dto.audio_intro_url;
    if (dto.cover_photo_url !== undefined)
      updatePayload.cover_photo_url = dto.cover_photo_url;
    if (dto.proficiency_level !== undefined)
      updatePayload.proficiency_level = dto.proficiency_level;
    if (dto.privacy_hide_age !== undefined)
      updatePayload.privacy_hide_age = dto.privacy_hide_age;
    if (dto.privacy_hide_location !== undefined)
      updatePayload.privacy_hide_location = dto.privacy_hide_location;
    if (dto.privacy_hide_from_search !== undefined)
      updatePayload.privacy_hide_from_search = dto.privacy_hide_from_search;
    if (dto.matchmaking_consent !== undefined)
      updatePayload.matchmaking_consent = dto.matchmaking_consent;
    if (dto.privacy_hide_gender !== undefined)
      updatePayload.privacy_hide_gender = dto.privacy_hide_gender;
    if (dto.privacy_hide_exact_location !== undefined)
      updatePayload.privacy_hide_exact_location =
        dto.privacy_hide_exact_location;
    if (dto.privacy_hide_online_status !== undefined)
      updatePayload.privacy_hide_online_status = dto.privacy_hide_online_status;
    if (dto.gender !== undefined) updatePayload.gender = dto.gender;
    if (dto.profile_visibility !== undefined)
      updatePayload.profile_visibility = dto.profile_visibility;
    if (dto.status_visibility !== undefined)
      updatePayload.status_visibility = dto.status_visibility;
    if (dto.interests !== undefined) updatePayload.interests = dto.interests;
    if (dto.learning_goals !== undefined)
      updatePayload.learning_goals = dto.learning_goals;
    if (dto.status_text !== undefined)
      updatePayload.status_text = dto.status_text;
    if (dto.mock_country !== undefined)
      updatePayload.mock_country = dto.mock_country;
    if (dto.mock_city !== undefined) updatePayload.mock_city = dto.mock_city;

    if (dto.greeting_message !== undefined)
      updatePayload.greeting_message = dto.greeting_message;
    if (dto.away_message !== undefined)
      updatePayload.away_message = dto.away_message;

    if (dto.silence_unknown_callers !== undefined)
      updatePayload.silence_unknown_callers = dto.silence_unknown_callers;

    if (dto.auto_play_voice_notes !== undefined)
      updatePayload.auto_play_voice_notes = dto.auto_play_voice_notes;

    if (dto.sound_effects_enabled !== undefined)
      updatePayload.sound_effects_enabled = dto.sound_effects_enabled;

    if (dto.vibration_enabled !== undefined)
      updatePayload.vibration_enabled = dto.vibration_enabled;

    if (dto.chat_enter_to_send !== undefined)
      updatePayload.chat_enter_to_send = dto.chat_enter_to_send;

    if (dto.chat_text_size !== undefined)
      updatePayload.chat_text_size = dto.chat_text_size;

    if (dto.serious_learner_mode !== undefined)
      updatePayload.serious_learner_mode = dto.serious_learner_mode;

    if (dto.auto_play_voice_notes !== undefined)
      updatePayload.auto_play_voice_notes = dto.auto_play_voice_notes;

    if (dto.auto_download_media !== undefined)
      updatePayload.auto_download_media = dto.auto_download_media;

    if (dto.auto_download_wifi_only !== undefined)
      updatePayload.auto_download_wifi_only = dto.auto_download_wifi_only;

    if (dto.auto_download_preference !== undefined)
      updatePayload.auto_download_preference = dto.auto_download_preference;

    if (dto.business_name !== undefined)
      updatePayload.business_name = dto.business_name;
    if (dto.business_hours !== undefined)
      updatePayload.business_hours = dto.business_hours;
    if (dto.website_url !== undefined)
      updatePayload.website_url = dto.website_url;
    if (dto.catalog !== undefined) updatePayload.catalog = dto.catalog;

    if (dto.location) {
      updatePayload.location = `POINT(${dto.location.longitude} ${dto.location.latitude})`;
    }

    if (dto.mock_location) {
      updatePayload.mock_location = `POINT(${dto.mock_location.longitude} ${dto.mock_location.latitude})`;
    }

    if (dto.message_filters !== undefined) {
      updatePayload.message_filters = dto.message_filters;
    }

    const supabase = this.supabaseService.getClient();
    const { error: updateError } = await supabase
      .from('users')
      .update(updatePayload as never)
      .eq('id', userId);
    if (updateError) {
      Logger.warn(
        `Supabase update failed, falling back to mock: ${updateError.message}`,
      );
    }

    // Invalidate matchmaking caches when profile fields that affect
    // discovery / recommendations / partner-of-week are mutated.
    this.invalidateMatchmakingCachesAfterUpdate(userId, dto);

    const profile = await this.getProfile(userId);

    // Fire-and-forget: emit profile.updated event for system bubble broadcasting
    this.eventEmitter.emit('profile.updated', { userId });

    return { ...profile, ...updatePayload };
  }

  /**
   * Invalidate Redis matchmaking caches when profile fields that drive
   * discovery, recommendations, or Partner of the Week eligibility are
   * mutated.
   */
  private invalidateMatchmakingCachesAfterUpdate(
    userId: string,
    dto: UpdateProfileDto,
  ): void {
    const affectsMatchmaking =
      dto.native_languages !== undefined ||
      dto.target_languages !== undefined ||
      dto.proficiency_level !== undefined ||
      dto.privacy_hide_from_search !== undefined ||
      dto.serious_learner_mode !== undefined ||
      dto.interests !== undefined;

    const affectsPartnerOfWeek =
      affectsMatchmaking ||
      dto.study_streak_days !== undefined ||
      dto.correction_ratio !== undefined;

    if (!affectsMatchmaking && !affectsPartnerOfWeek) return;

    void (async () => {
      try {
        const redis = this.supabaseService.getRedisClient();
        const keys: string[] = [];

        if (affectsMatchmaking) {
          keys.push(
            `daily_recommendations:${userId}`,
            `recommendations:daily:${userId}`,
          );
        }

        if (affectsPartnerOfWeek) {
          keys.push('partner_of_week_ids');
        }

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (err: unknown) {
        // Non-critical cache invalidation; log and continue.
        Logger.warn(
          `Failed to invalidate matchmaking caches after profile update for ${userId}: ${(err as Error)?.message ?? 'unknown'}`,
        );
      }
    })();
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<UserProfile> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ notification_preferences: dto } as never)
      .eq('id', userId);
    if (error) {
      Logger.warn(
        `Supabase update for notification preferences failed, falling back to mock: ${error.message}`,
      );
      const mock = this.getMockProfile(userId);
      return {
        ...mock,
        notification_preferences: dto,
      };
    }
    return this.getProfile(userId);
  }

  async updateGreetingMessage(
    userId: string,
    greetingMessage: string,
  ): Promise<UserProfile> {
    const isVip = Boolean((await this.getProfile(userId))?.is_vip ?? false);
    return this.updateProfile(
      userId,
      { greeting_message: greetingMessage },
      isVip,
    );
  }

  async updateAwayMessage(
    userId: string,
    awayMessage: string,
  ): Promise<UserProfile> {
    const isVip = Boolean((await this.getProfile(userId))?.is_vip ?? false);
    return this.updateProfile(userId, { away_message: awayMessage }, isVip);
  }

  async scheduleDeletion(
    userId: string,
  ): Promise<{ message: string; scheduled_for_deletion_at: string }> {
    const supabase = this.supabaseService.getClient();
    const deletionDate = new Date();
    deletionDate.setDate(new Date().getDate() + 30); // 30-day grace period

    const { error } = await supabase
      .from('users')
      .update({
        scheduled_for_deletion_at: deletionDate.toISOString(),
      } as never)
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to schedule account deletion: ${error.message}`,
      );
    }

    return {
      message: 'Account scheduled for deletion in 30 days.',
      scheduled_for_deletion_at: deletionDate.toISOString(),
    };
  }

  async cancelDeletion(userId: string): Promise<{ message: string }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ scheduled_for_deletion_at: null } as never)
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to cancel account deletion: ${error.message}`,
      );
    }

    return { message: 'Account deletion cancelled successfully.' };
  }

  async blockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean }> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('blocks')
      .insert([{ blocker_id: blockerId, blocked_id: blockedId }] as never);
    if (error) {
      Logger.warn(`Block insert failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to block user');
    }
    return { success: true };
  }

  async unblockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    if (error) {
      Logger.warn(`Unblock delete failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to unblock user');
    }
    return { success: true };
  }

  async reportUser(
    reporterId: string,
    dto: {
      reported_id: string;
      reason_category: string;
      description?: string;
      context_url?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('reports').insert([
      {
        reporter_id: reporterId,
        reported_user_id: dto.reported_id,
        reason_category: dto.reason_category,
        description: dto.description ?? '',
        context_url: dto.context_url ?? null,
      },
    ]);
    if (error) {
      Logger.warn(`Report insert failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to report user');
    }
    return { success: true, message: 'Report submitted' };
  }

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    return this.dataExportWorker.exportUserData(userId);
  }

  async getPrivacySettings(userId: string): Promise<{
    privacy_hide_age: boolean;
    privacy_hide_location: boolean;
    privacy_hide_from_search: boolean;
    privacy_hide_gender: boolean;
    silence_unknown_callers?: boolean;
    privacy_last_seen?: string;
    privacy_profile_photo?: string;
    privacy_about_info?: string;
    privacy_status?: string;
    privacy_hide_vip_status?: boolean;
    incognito_visits?: boolean;
    status_visibility?: string;
    profile_visibility?: 'everyone' | 'vips_only' | 'hidden';
  }> {
    const profile = await this.getProfile(userId);
    const privacyRecord = profile as unknown as Record<string, unknown>;
    return {
      privacy_hide_age: profile.privacy_hide_age ?? false,
      privacy_hide_location: profile.privacy_hide_location ?? false,
      privacy_hide_from_search: profile.privacy_hide_from_search ?? false,
      privacy_hide_gender: profile.privacy_hide_gender ?? false,
      silence_unknown_callers: profile.silence_unknown_callers ?? false,
      privacy_last_seen:
        (privacyRecord.privacy_last_seen as string | undefined) ?? 'everyone',
      privacy_profile_photo:
        (privacyRecord.privacy_profile_photo as string | undefined) ??
        'everyone',
      privacy_about_info:
        (privacyRecord.privacy_about_info as string | undefined) ?? 'everyone',
      privacy_status:
        (privacyRecord.privacy_status as string | undefined) ?? 'everyone',
      privacy_hide_vip_status:
        (privacyRecord.privacy_hide_vip_status as boolean | undefined) ?? false,
      incognito_visits: profile.incognito_visits ?? false,
      status_visibility:
        (profile as unknown as { status_visibility?: string })
          .status_visibility ?? 'public',
      profile_visibility:
        (privacyRecord.profile_visibility as
          'everyone' | 'vips_only' | 'hidden' | undefined) ?? 'everyone',
    };
  }

  async getBusinessProfile(userId: string): Promise<{
    business_name?: string;
    business_hours?: string;
    website_url?: string;
    catalog?: BusinessCatalogItem[];
  }> {
    const profile = await this.getProfile(userId);
    return {
      business_name: profile.business_name,
      business_hours: profile.business_hours,
      website_url: profile.website_url,
      catalog: profile.catalog ?? [],
    };
  }

  async updateBusinessProfile(
    userId: string,
    dto: UpdateBusinessProfileDto,
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    const profileUpdate: UpdateProfileDto = {
      business_name: dto.business_name,
      business_hours: dto.business_hours,
      website_url: dto.website_url,
      catalog: dto.catalog,
    };
    return this.updateProfile(
      userId,
      profileUpdate,
      Boolean(profile?.is_vip ?? false),
    );
  }

  async awardCoins(userId: string, amount: number): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.rpc('increment_xp', {
      user_id: userId,
      amount,
    });
    if (error) {
      const { data: cur } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', userId)
        .single();
      const current =
        ((cur as { coins_balance?: number })?.coins_balance ?? 0) + amount;
      await supabase
        .from('users')
        .update({ coins_balance: current } as never)
        .eq('id', userId);
    }
  }

  async getMessageFilters(userId: string): Promise<{
    age_min?: number;
    age_max?: number;
    allowed_native_languages?: string[];
    allowed_genders?: string[];
  }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('message_filters')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return {};
    }
    return (
      (data as { message_filters?: Record<string, unknown> })
        ?.message_filters ?? {}
    );
  }

  async setMessageFilters(
    userId: string,
    filters: {
      age_min?: number;
      age_max?: number;
      allowed_native_languages?: string[];
      allowed_genders?: string[];
    },
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ message_filters: filters } as never)
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to update message filters: ${error.message}`,
      );
    }
  }

  async getFollowers(
    userId: string,
    limit = 20,
    offset = 0,
    viewerId?: string,
  ): Promise<{ data: UserProfile[]; total: number }> {
    const supabase = this.supabaseService.getClient();
    const { count, error: countError } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId);
    if (countError) {
      throw new InternalServerErrorException('Failed to count followers');
    }
    const total = count ?? 0;
    const { data, error } = await supabase
      .from('user_follows')
      .select(
        `
        follower_id,
        follower:follower_id (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      throw new InternalServerErrorException('Failed to fetch followers');
    }
    const rows = (data ?? []) as unknown as Array<{
      follower: UserProfile;
    }>;
    const users = rows.map((row) => row.follower);
    return { data: await this.attachIsFollowedByMe(users, viewerId), total };
  }

  async getFollowing(
    userId: string,
    limit = 20,
    offset = 0,
    viewerId?: string,
  ): Promise<{ data: UserProfile[]; total: number }> {
    const supabase = this.supabaseService.getClient();
    const { count, error: countError } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId);
    if (countError) {
      throw new InternalServerErrorException('Failed to count following');
    }
    const total = count ?? 0;
    const { data, error } = await supabase
      .from('user_follows')
      .select(
        `
        following_id,
        following:following_id (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      throw new InternalServerErrorException('Failed to fetch following');
    }
    const rows = (data ?? []) as unknown as Array<{
      following: UserProfile;
    }>;
    const users = rows.map((row) => row.following);
    return { data: await this.attachIsFollowedByMe(users, viewerId), total };
  }

  private async attachIsFollowedByMe(
    users: UserProfile[],
    viewerId?: string,
  ): Promise<UserProfile[]> {
    if (!viewerId || users.length === 0) {
      return users;
    }
    const supabase = this.supabaseService.getClient();
    const { data: followsData, error: followsError } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', viewerId)
      .in(
        'following_id',
        users.map((user) => user.id),
      );

    if (followsError) {
      throw new InternalServerErrorException('Failed to fetch follow data');
    }

    const followedIds = new Set(
      (followsData ?? []).map(
        (row: { following_id: string }) => row.following_id,
      ),
    );
    return users.map((user) => ({
      ...user,
      is_followed_by_me: followedIds.has(user.id),
    }));
  }

  async generateDeviceLink(userId: string): Promise<string> {
    const supabase = this.supabaseService.getClient();

    // Retrieve the user's primary email from Supabase auth
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      throw new InternalServerErrorException(
        'Unable to retrieve user email for device linking',
      );
    }
    const email = data.user.email;

    // Generate a one‑time magic link that the other device can use to sign in
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
    if (linkError || !linkData?.properties?.action_link) {
      throw new InternalServerErrorException(
        'Unable to generate device‑link URL',
      );
    }

    return linkData.properties.action_link;
  }

  async updatePrivacySettings(
    userId: string,
    settings: {
      privacy_last_seen?: string;
      privacy_profile_photo?: string;
      privacy_about_info?: string;
      privacy_status?: string;
      incognito_visits?: boolean;
      privacy_hide_vip_status?: boolean;
      status_visibility?: string;
      profile_visibility?: 'everyone' | 'vips_only' | 'hidden';
    },
    isVip: boolean,
  ): Promise<UserProfile> {
    if (settings.incognito_visits && !isVip) {
      throw new BadRequestException(
        'Incognito profile visiting requires a VIP subscription (8 UKP / $10 USD per month).',
      );
    }

    const supabase = this.supabaseService.getClient();

    const updatePayload: Record<string, unknown> = {};
    if (settings.privacy_last_seen !== undefined)
      updatePayload.privacy_last_seen = settings.privacy_last_seen;
    if (settings.privacy_profile_photo !== undefined)
      updatePayload.privacy_profile_photo = settings.privacy_profile_photo;
    if (settings.privacy_about_info !== undefined)
      updatePayload.privacy_about_info = settings.privacy_about_info;
    if (settings.privacy_status !== undefined)
      updatePayload.privacy_status = settings.privacy_status;
    if (settings.incognito_visits !== undefined)
      updatePayload.incognito_visits = settings.incognito_visits;
    if (settings.privacy_hide_vip_status !== undefined)
      updatePayload.privacy_hide_vip_status = settings.privacy_hide_vip_status;
    if (settings.status_visibility !== undefined)
      updatePayload.status_visibility = settings.status_visibility;
    if (settings.profile_visibility !== undefined)
      updatePayload.profile_visibility = settings.profile_visibility;

    const { error: privacyUpdateError } = await supabase
      .from('users')
      .update(updatePayload as never)
      .eq('id', userId);
    if (privacyUpdateError) {
      Logger.warn(
        `Supabase update for privacy settings failed, falling back to mock: ${privacyUpdateError.message}`,
      );
      const mock = this.getMockProfile(userId);
      return { ...mock, ...updatePayload };
    }
    return this.getProfile(userId);
  }

  async getUserStats(userId: string): Promise<
    Partial<UserProfile> & {
      momentsCount: number;
      commentsCount: number;
      followersCount: number;
      followingCount: number;
      profileVisitsCount: number;
    }
  > {
    const supabase = this.supabaseService.getClient();

    const [
      userRes,
      momentsCountRes,
      commentsCountRes,
      followersCountRes,
      followingCountRes,
      visitsCountRes,
    ] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('moments')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', userId),
      supabase
        .from('moment_comments')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', userId),
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('user_follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
      supabase
        .from('profile_visits')
        .select('id', { count: 'exact', head: true })
        .eq('viewed_id', userId),
    ]);

    if (userRes.error || !userRes.data) {
      throw new NotFoundException(`User stats not found for user ${userId}`);
    }

    const user = userRes.data as UserProfile;
    const momentsCount = momentsCountRes.count ?? 0;
    const commentsCount = commentsCountRes.count ?? 0;
    const followersCount = followersCountRes.count ?? 0;
    const followingCount = followingCountRes.count ?? 0;
    const profileVisitsCount = visitsCountRes.count ?? 0;

    return {
      ...(user as unknown as Record<string, unknown>),
      momentsCount,
      commentsCount,
      followersCount,
      followingCount,
      profileVisitsCount,
    };
  }

  getAvailableHobbies(): string[] {
    return PREDEFINED_HOBBIES;
  }

  getAvailableInterests(): string[] {
    return PREDEFINED_INTERESTS;
  }

  async getBadges(
    userId: string,
  ): Promise<{ id: string; name: string; description: string }[]> {
    const profile = await this.getProfile(userId);
    const badges: { id: string; name: string; description: string }[] = [];
    if (profile.is_vip) {
      badges.push({
        id: 'vip',
        name: 'VIP User',
        description:
          'This user has a VIP subscription (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent)',
      });
    }
    if (profile.is_serious_learner) {
      badges.push({
        id: 'serious_learner',
        name: 'Serious Learner',
        description: 'User maintains a high study streak and correction ratio',
      });
    }
    return badges;
  }

  shareContact(
    requesterId: string,
    targetUserId: string,
  ): Promise<{ phone_number?: string; email?: string }> {
    if (!requesterId || !targetUserId) {
      throw new BadRequestException('User IDs are required');
    }
    // Placeholder implementation to support contact sharing.
    // Future iterations will retrieve details from the user's profile.
    return Promise.resolve({
      phone_number: '+447700900123',
      email: 'partner@example.com',
    });
  }

  async permanentDeleteAccount(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Delete related data from multiple tables
    const deletionTasks: Array<{
      table:
        | 'moments'
        | 'moment_comments'
        | 'moment_likes'
        | 'flashcards'
        | 'chat_messages'
        | 'favourites'
        | 'profile_visits'
        | 'user_follows'
        | 'user_profile_likes'
        | 'status_views';
      column:
        | 'author_id'
        | 'user_id'
        | 'sender_id'
        | 'visitor_id'
        | 'viewed_id'
        | 'follower_id'
        | 'following_id'
        | 'liker_id'
        | 'liked_id'
        | 'viewer_id'
        | 'status_owner_id';
    }> = [
      { table: 'moments', column: 'author_id' },
      { table: 'moment_comments', column: 'author_id' },
      { table: 'moment_likes', column: 'user_id' },
      { table: 'flashcards', column: 'user_id' },
      { table: 'chat_messages', column: 'sender_id' },
      { table: 'favourites', column: 'user_id' },
      { table: 'profile_visits', column: 'visitor_id' },
      { table: 'profile_visits', column: 'viewed_id' },
      { table: 'user_follows', column: 'follower_id' },
      { table: 'user_follows', column: 'following_id' },
      { table: 'user_profile_likes', column: 'liker_id' },
      { table: 'user_profile_likes', column: 'liked_id' },
      { table: 'status_views', column: 'viewer_id' },
      { table: 'status_views', column: 'status_owner_id' },
    ];

    const results = await Promise.all(
      deletionTasks.map(async ({ table, column }) => {
        const { error } = await supabase
          .from(table as never)
          .delete()
          .eq(column, userId);
        return { error };
      }),
    );
    const errors = results.filter((r) => r.error).map((r) => r.error?.message);
    if (errors.length > 0) {
      Logger.warn(
        `Some deletions failed for user ${userId}: ${errors.join(', ')}`,
      );
    }

    // GDPR: scrub escrow_transactions records for the deleted user.
    // Rather than deleting escrow records (which would break the financial
    // ledger for the counterparty), we anonymise user identifiers and scrub
    // free-text fields.
    const DELETED_USER_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

    const now = new Date().toISOString();

    // Anonymise escrow records where the user was the payer
    const { error: escrowPayerError } = await supabase
      .from('escrow_transactions')
      .update({
        payer_id: DELETED_USER_PLACEHOLDER,
        description: null,
        reference_id: null,
        updated_at: now,
      })
      .eq('payer_id', userId);

    if (escrowPayerError) {
      Logger.warn(
        `Failed to anonymise payer escrow records for user ${userId}: ${escrowPayerError.message}`,
      );
    }

    // Anonymise escrow records where the user was the payee
    const { error: escrowPayeeError } = await supabase
      .from('escrow_transactions')
      .update({
        payee_id: DELETED_USER_PLACEHOLDER,
        description: null,
        reference_id: null,
        updated_at: now,
      })
      .eq('payee_id', userId);

    if (escrowPayeeError) {
      Logger.warn(
        `Failed to anonymise payee escrow records for user ${userId}: ${escrowPayeeError.message}`,
      );
    }

    // Finally delete the user profile
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      Logger.error(`Failed to delete user ${userId}: ${userError.message}`);
      throw new InternalServerErrorException(
        `Failed to delete account: ${userError.message}`,
      );
    }
  }
}
