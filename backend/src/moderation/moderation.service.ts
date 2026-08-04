import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportUserDto } from './dto/report-user.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';

export interface Reporter {
  id: string;
  display_name: string;
}

export interface ModerationItem {
  id: string;
  status: string;
  reason: string;
  created_at: string;
  description?: string;
  reporter: Reporter | null;
  reported_user: Reporter | null;
  reportedMomentId?: string | null;
  moment_content?: string;
  momentAuthorName?: string;
}

@Injectable()
export class ModerationService {
  private readonly supabase: ReturnType<SupabaseService['getClient']>;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async getItems(
    type: 'moment' | 'profile',
    status?: string,
  ): Promise<ModerationItem[]> {
    let query = this.supabase
      .from('reports')
      .select(
        `
        id,
        status,
        reason_category,
        created_at,
        reporter_id,
        reported_user_id,
        reported_moment_id,
        description,
        reporter:reporter_id ( id, display_name ),
        reported_user:reported_user_id ( id, display_name )
      `,
      )
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new NotFoundException('Failed to fetch moderation items.');
    }

    const rows = (data ?? []) as unknown[];

    const items: ModerationItem[] = rows.map((row) => {
      const obj = row as { [key: string]: unknown };
      return {
        id: obj.id as string,
        status: obj.status as string,
        reason: obj.reason_category as string,
        created_at: obj.created_at as string,
        description: obj.description as string | undefined,
        reporter: obj.reporter as Reporter | null,
        reported_user: obj.reported_user as Reporter | null,
        reportedMomentId: (obj.reported_moment_id as string | null) ?? null,
      };
    });

    if (type === 'profile') {
      return items.filter((item) => item.reported_user != null);
    }

    // For moment reports, fetch the attached moment content
    const momentItems = items.filter((item) => item.reportedMomentId != null);

    const hydrated: ModerationItem[] = [];
    for (const item of momentItems) {
      const moment = await this.getMomentContent(
        item.reportedMomentId as string,
      );
      if (moment) {
        hydrated.push({
          ...item,
          moment_content: moment.content_text,
          momentAuthorName: moment.authorName,
        });
      }
    }

    return hydrated;
  }

  private async getMomentContent(
    momentId: string,
  ): Promise<{ content_text: string; authorName: string | null } | null> {
    const { data, error } = await this.supabase
      .from('moments')
      .select('content_text, author_id, author:author_id ( display_name )')
      .eq('id', momentId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as {
      content_text: string;
      author: { display_name?: string } | null;
    };

    return {
      content_text: row.content_text ?? '',
      authorName: row.author?.display_name ?? null,
    };
  }

  async reportUser(reporterId: string, dto: ReportUserDto) {
    const { data, error } = await this.supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: dto.reportedUserId,
      reason_category: dto.reasonCategory,
      description: dto.description ?? null,
      status: 'pending',
    });

    if (error) {
      throw new NotFoundException('Failed to create report');
    }

    return data;
  }

  async approveItem(dto: ModerationActionDto) {
    const { error } = await this.supabase
      .from('reports')
      .update({ status: 'approved' })
      .eq('id', dto.itemId);

    if (error) {
      throw new NotFoundException('Failed to approve item');
    }

    return { success: true };
  }

  async rejectItem(dto: ModerationActionDto) {
    const { error } = await this.supabase
      .from('reports')
      .update({
        status: 'rejected',
        reason_category: dto.reason ?? null,
      })
      .eq('id', dto.itemId);

    if (error) {
      throw new NotFoundException('Failed to reject item');
    }

    return { success: true };
  }

  async analyseUserForDatingBehaviour(
    userId: string,
  ): Promise<{ riskScore: number; flags: string[] }> {
    const { data: userData, error: userError } = await this.supabase
      .from('users')
      .select(
        'display_name, bio_text, target_languages, native_language, status_text, greeting_message, away_message',
      )
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new NotFoundException('User not found');
    }

    const u = userData as {
      display_name: string;
      bio_text: string;
      native_language: string;
      target_languages: string[];
      status_text?: string;
      greeting_message?: string;
      away_message?: string;
    };

    const combinedText = [
      u.display_name ?? '',
      u.bio_text ?? '',
      u.native_language ?? '',
      (u.target_languages ?? []).join(' '),
      u.status_text ?? '',
      u.greeting_message ?? '',
      u.away_message ?? '',
    ].join(' ');

    const { data: moments } = await this.supabase
      .from('moments')
      .select('content_text')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    const momentRows = (moments ?? []) as unknown[];
    const momentText = momentRows
      .map((row) => {
        const obj = row as { content_text?: string };
        return obj.content_text ?? '';
      })
      .join(' ');

    const fullText = (combinedText + ' ' + momentText).toLowerCase();

    const datingFlags = [
      'dating',
      'date',
      'relationship',
      'boyfriend',
      'girlfriend',
      'love',
      'marry',
      'marriage',
      'romance',
      'romantic',
      'sex',
      'hookup',
      'flirt',
      'hot',
      'sexy',
      'single',
      'looking for',
      'meetup',
      'in a relationship',
      'partner',
      'romantically',
      'kiss',
      'kissing',
      'date me',
      'looking for a man',
      'looking for a woman',
      'man for me',
      'woman for me',
      'marry me',
      'fwb',
      'friends with benefits',
      'casual sex',
      'affair',
      'dinner',
      'coffee',
      'drinks',
      'hang out',
      'meet up',
      'hook up',
      'one night',
      'sexting',
      'daddy',
      'mommy',
      'horny',
    ];

    const flags: string[] = [];
    const regexFlags = [...new Set(datingFlags)];

    for (const flag of regexFlags) {
      const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(fullText)) {
        flags.push(flag);
      }
    }

    const uniqueFlags = [...new Set(flags)];
    const hitRatio = uniqueFlags.length / regexFlags.length;
    const riskScore = Math.min(
      100,
      Math.round(
        hitRatio * 100 +
          (uniqueFlags.length > 5 ? 20 : 0) +
          (uniqueFlags.length > 10 ? 10 : 0),
      ),
    );

    return { riskScore, flags: uniqueFlags };
  }
}
