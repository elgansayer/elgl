import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { ProfileViewEvent } from '../notifications/events/notification.events';

const PROFILE_VISIT_RETENTION_DAYS = 90;
const DEFAULT_VISITOR_PAGE_SIZE = 20;
const MAX_VISITOR_PAGE_SIZE = 50;

export interface VisitorUser {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
  native_languages: string[];
  target_languages: string[];
  bio_text?: string;
  is_vip?: boolean;
}

export interface ProfileVisitRecord {
  id: string;
  created_at: string;
  is_blurred: boolean;
  visitor: VisitorUser;
}

export interface ProfileVisitorsPage {
  items: ProfileVisitRecord[];
  identity_visible: boolean;
  limit: number;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

export type ProfileVisitIgnoreReason =
  'self' | 'incognito' | 'blocked' | 'unavailable' | 'duplicate';

export interface RecordProfileVisitResult {
  recorded: boolean;
  ignored: boolean;
  reason?: ProfileVisitIgnoreReason;
  visit_id?: string;
}

interface RawVisitorUser extends VisitorUser {
  is_deleted?: boolean | null;
  scheduled_for_deletion_at?: string | null;
  profile_visibility?: string | null;
}

interface RawVisitRow {
  id: string;
  created_at: string;
  visitor: RawVisitorUser | RawVisitorUser[] | null;
}

interface VisitorPrivacyRow {
  is_vip?: boolean | null;
  incognito_visits?: boolean | null;
  is_deleted?: boolean | null;
  scheduled_for_deletion_at?: string | null;
}

interface ViewedProfileRow {
  id: string;
  is_vip?: boolean | null;
  is_deleted?: boolean | null;
  scheduled_for_deletion_at?: string | null;
  profile_visibility?: string | null;
}

@Injectable()
export class ProfileVisitsService {
  private readonly logger = new Logger(ProfileVisitsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async recordVisit(
    visitorId: string,
    viewedId: string,
  ): Promise<RecordProfileVisitResult> {
    if (visitorId === viewedId) {
      return { recorded: false, ignored: true, reason: 'self' };
    }

    const supabase = this.supabaseService.getClient();
    const { data: visitor, error: visitorError } = await supabase
      .from('users')
      .select('is_vip, incognito_visits, is_deleted, scheduled_for_deletion_at')
      .eq('id', visitorId)
      .single();

    if (visitorError || !visitor) {
      this.logger.warn(
        'Profile visit rejected because viewer privacy could not be verified',
      );
      throw new Error('Failed to verify profile-visit privacy');
    }

    const visitorPrivacy = visitor as VisitorPrivacyRow;
    if (visitorPrivacy.is_deleted || visitorPrivacy.scheduled_for_deletion_at) {
      return { recorded: false, ignored: true, reason: 'unavailable' };
    }

    if (visitorPrivacy.is_vip && visitorPrivacy.incognito_visits) {
      return { recorded: false, ignored: true, reason: 'incognito' };
    }

    const { data: viewedProfile, error: viewedProfileError } = await supabase
      .from('users')
      .select(
        'id, is_vip, is_deleted, scheduled_for_deletion_at, profile_visibility',
      )
      .eq('id', viewedId)
      .single();

    if (viewedProfileError) {
      this.logger.warn(
        'Profile visit rejected because target visibility could not be verified',
      );
      throw new Error('Failed to verify viewed profile');
    }

    const viewedProfilePrivacy = viewedProfile as ViewedProfileRow | null;
    if (
      !viewedProfilePrivacy ||
      this.isUnavailableProfile(
        viewedProfilePrivacy,
        Boolean(visitorPrivacy.is_vip),
      )
    ) {
      return { recorded: false, ignored: true, reason: 'unavailable' };
    }

    if (await this.areUsersBlocked(visitorId, viewedId)) {
      return { recorded: false, ignored: true, reason: 'blocked' };
    }

    // visit_day is assigned by the database in UTC. Keeping the day calculation at
    // the storage boundary makes retries from every API client converge on the same
    // unique (visitor_id, viewed_id, visit_day) key.
    const response = await supabase
      .from('profile_visits')
      .insert({
        visitor_id: visitorId,
        viewed_id: viewedId,
      })
      .select('id, created_at')
      .single();

    if (response.error) {
      if (response.error.code === '23505') {
        return { recorded: false, ignored: true, reason: 'duplicate' };
      }

      this.logger.error(
        `Failed to persist profile visit: ${response.error.message}`,
      );
      throw new Error('Failed to record profile visit');
    }

    if (!response.data) {
      this.logger.error('Profile visit insert returned no row');
      throw new Error('Failed to record profile visit');
    }

    this.eventEmitter.emit(
      'profile.visit',
      new ProfileViewEvent(
        visitorId,
        viewedId,
        Boolean(viewedProfilePrivacy.is_vip),
      ),
    );

    return {
      recorded: true,
      ignored: false,
      visit_id: String(response.data.id),
    };
  }

  async getVisitors(
    userId: string,
    limit = DEFAULT_VISITOR_PAGE_SIZE,
    offset = 0,
  ): Promise<ProfileVisitorsPage> {
    const safeLimit = Math.min(
      Math.max(Math.trunc(limit) || DEFAULT_VISITOR_PAGE_SIZE, 1),
      MAX_VISITOR_PAGE_SIZE,
    );
    const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
    const supabase = this.supabaseService.getClient();

    const { data: owner, error: ownerError } = await supabase
      .from('users')
      .select('is_vip, is_deleted, scheduled_for_deletion_at')
      .eq('id', userId)
      .single();

    if (ownerError || !owner) {
      this.logger.warn('Visitor-log entitlement could not be verified');
      throw new Error('Failed to verify visitor-log entitlement');
    }

    const ownerPrivacy = owner as VisitorPrivacyRow;
    if (ownerPrivacy.is_deleted || ownerPrivacy.scheduled_for_deletion_at) {
      return {
        items: [],
        identity_visible: false,
        limit: safeLimit,
        offset: safeOffset,
        has_more: false,
        next_offset: null,
      };
    }

    const cutoff = new Date(
      Date.now() - PROFILE_VISIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const response = await supabase
      .from('profile_visits')
      .select(
        `
        id,
        created_at,
        visitor:users!profile_visits_visitor_id_fkey (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages,
          bio_text,
          is_vip,
          is_deleted,
          scheduled_for_deletion_at,
          profile_visibility
        )
      `,
      )
      .eq('viewed_id', userId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit);

    if (response.error || !response.data) {
      const message = response.error?.message ?? 'No data returned';
      this.logger.error(`Failed to fetch profile visitors: ${message}`);
      throw new Error('Failed to fetch profile visitors');
    }

    const rawRows = response.data as unknown as RawVisitRow[];
    const hasMore = rawRows.length > safeLimit;
    const pageRows = rawRows.slice(0, safeLimit);
    const visibleRows = pageRows
      .map((row) => ({ row, visitor: this.normaliseVisitor(row.visitor) }))
      .filter(({ visitor }) => visitor && !this.isUnavailableVisitor(visitor));
    const identityVisible = Boolean(ownerPrivacy.is_vip);

    const items = visibleRows.map(({ row, visitor }) => {
      if (!identityVisible) {
        return {
          id: row.id,
          created_at: row.created_at,
          is_blurred: true,
          visitor: {
            id: 'hidden-vip-only',
            display_name: 'Someone viewed your profile',
            avatar_url: null,
            native_languages: [],
            target_languages: [],
          },
        } satisfies ProfileVisitRecord;
      }

      return {
        id: row.id,
        created_at: row.created_at,
        is_blurred: false,
        visitor: visitor as VisitorUser,
      } satisfies ProfileVisitRecord;
    });

    return {
      items,
      identity_visible: identityVisible,
      limit: safeLimit,
      offset: safeOffset,
      has_more: hasMore,
      next_offset: hasMore ? safeOffset + safeLimit : null,
    };
  }

  async getVisitCount(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const cutoff = new Date(
      Date.now() - PROFILE_VISIT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const response = await supabase
      .from('profile_visits')
      .select('*', { count: 'exact', head: true })
      .eq('viewed_id', userId)
      .gte('created_at', cutoff);

    if (response.error) {
      throw new Error(`Failed to fetch visit count: ${response.error.message}`);
    }

    return response.count ?? 0;
  }

  async deleteVisit(visitId: string): Promise<Record<string, unknown>> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('profile_visits')
      .delete()
      .eq('id', visitId)
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      throw new Error(`Failed to delete visit: ${msg}`);
    }

    return response.data;
  }

  private async areUsersBlocked(
    visitorId: string,
    viewedId: string,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const directions = [
      [visitorId, viewedId],
      [viewedId, visitorId],
    ] as const;

    for (const [blockerId, blockedId] of directions) {
      const { data, error } = await supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
        .limit(1);

      if (error) {
        this.logger.warn(
          'Profile visit rejected because block state could not be verified',
        );
        throw new Error('Failed to verify profile-visit block state');
      }

      if (data && data.length > 0) return true;
    }

    return false;
  }

  private isUnavailableProfile(
    profile: ViewedProfileRow,
    visitorIsVip: boolean,
  ): boolean {
    return Boolean(
      profile.is_deleted ||
      profile.scheduled_for_deletion_at ||
      profile.profile_visibility === 'hidden' ||
      (profile.profile_visibility === 'vips_only' && !visitorIsVip),
    );
  }

  private isUnavailableVisitor(visitor: RawVisitorUser): boolean {
    return Boolean(
      visitor.is_deleted ||
      visitor.scheduled_for_deletion_at ||
      visitor.profile_visibility === 'hidden',
    );
  }

  private normaliseVisitor(
    visitor: RawVisitRow['visitor'],
  ): RawVisitorUser | null {
    if (Array.isArray(visitor)) return visitor[0] ?? null;
    return visitor;
  }
}
