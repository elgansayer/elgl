import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { ProfileViewEvent } from '../notifications/events/notification.events';

export interface VisitorUser {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
  native_language: string;
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

interface RawVisitRow {
  id: string;
  created_at: string;
  visitor: VisitorUser;
}

@Injectable()
export class ProfileVisitsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async recordVisit(
    visitorId: string,
    viewedId: string,
    isVipVisitor: boolean,
  ): Promise<Record<string, unknown>> {
    if (visitorId === viewedId) return { ignored: true };

    const supabase = this.supabaseService.getClient();

    if (isVipVisitor) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('incognito_visits')
        .eq('id', visitorId)
        .single();

      if (userError || !user) {
        const msg = userError?.message ?? 'Unknown error';
        throw new Error(`Failed to load visitor privacy settings: ${msg}`);
      }

      if (user.incognito_visits) {
        return { incognito: true, ignored: true };
      }
    }

    const response = await supabase
      .from('profile_visits')
      .insert({
        visitor_id: visitorId,
        viewed_id: viewedId,
      })
      .select()
      .single();

    if (response.error || !response.data) {
      const msg = response.error?.message ?? 'Unknown error';
      throw new Error(`Failed to record visit: ${msg}`);
    }

    // Emit push notification event
    this.eventEmitter.emit(
      'profile.view',
      new ProfileViewEvent(visitorId, viewedId),
    );

    return response.data;
  }

  async getVisitors(
    userId: string,
    isOwnerVip: boolean,
  ): Promise<ProfileVisitRecord[]> {
    const supabase = this.supabaseService.getClient();
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
          native_language,
          target_languages,
          bio_text,
          is_vip
        )
      `,
      )
      .eq('viewed_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (response.error || !response.data) {
      return [];
    }

    const rows = response.data as unknown as RawVisitRow[];

    if (!isOwnerVip) {
      return rows.map((visit) => ({
        id: visit.id,
        created_at: visit.created_at,
        is_blurred: true,
        visitor: {
          id: 'hidden-vip-only',
          display_name: 'Someone near you',
          avatar_url: null,
          native_language: visit.visitor?.native_language || 'en',
          target_languages: visit.visitor?.target_languages || ['es'],
        },
      }));
    }

    return rows.map((visit) => ({
      id: visit.id,
      created_at: visit.created_at,
      is_blurred: false,
      visitor: visit.visitor,
    }));
  }

  async getVisitCount(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('profile_visits')
      .select('count(*) as visit_count')
      .eq('viewed_id', userId)
      .single();

    if (response.error) {
      throw new Error(`Failed to fetch visit count: ${response.error.message}`);
    }

    const data = response.data as unknown as { visit_count: number } | null;
    return data?.visit_count ?? 0;
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
}
