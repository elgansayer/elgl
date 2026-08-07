import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportUserDto } from './dto/report-user.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';
import { ModerationQueryDto } from './dto/moderation-query.dto';

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
  momentAuthorName?: string | null;
}

export interface ModerationItemsResult {
  items: ModerationItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Maximum content length to avoid oversized payloads */
const MAX_MOMENT_CONTENT_LENGTH = 500;

/** Pre-compiled dating keyword regex (built once at module load) */
const DATING_KEYWORDS = [
  'dating', 'date', 'relationship', 'boyfriend', 'girlfriend',
  'love', 'marry', 'marriage', 'romance', 'romantic',
  'sex', 'hookup', 'flirt', 'hot', 'sexy',
  'single', 'looking for', 'meetup', 'in a relationship', 'partner',
  'romantically', 'kiss', 'kissing', 'date me',
  'looking for a man', 'looking for a woman', 'man for me', 'woman for me',
  'marry me', 'fwb', 'friends with benefits', 'casual sex', 'affair',
  'dinner', 'coffee', 'drinks', 'hang out', 'meet up',
  'hook up', 'one night', 'sexting', 'daddy', 'mommy', 'horny',
];

const DATING_REGEXES = DATING_KEYWORDS.map((kw) => {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { keyword: kw, regex: new RegExp(`\\b${escaped}\\b`, 'i') };
});

@Injectable()
export class ModerationService {
  private readonly supabase: ReturnType<SupabaseService['getClient']>;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async getItems(query: ModerationQueryDto): Promise<ModerationItemsResult> {
    const type = query.type ?? 'profile';
    const status = query.status;
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let dbQuery = this.supabase
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
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (type === 'profile') {
      dbQuery = dbQuery.not('reported_user_id', 'is', null);
    } else {
      dbQuery = dbQuery.not('reported_moment_id', 'is', null);
    }

    const { data, error, count } = await dbQuery;

    if (error) {
      throw new NotFoundException('Failed to fetch moderation items.');
    }

    const rows = (data ?? []) as unknown[];
    const items: ModerationItem[] = rows.map((row) => {
      const obj = row as Record<string, unknown>;
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

    // Batch-hydrate moment content for moment-type items
    if (type === 'moment') {
      const momentIds = items
        .filter((item) => item.reportedMomentId != null)
        .map((item) => item.reportedMomentId as string);

      const momentContentMap = await this.batchGetMomentContent(momentIds);

      for (const item of items) {
        if (item.reportedMomentId) {
          const content = momentContentMap.get(item.reportedMomentId);
          if (content) {
            item.moment_content = content.content_text;
            item.momentAuthorName = content.authorName;
          }
        }
      }
    }

    return {
      items,
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Batch-fetch moment content in one query (fixes N+1).
   */
  private async batchGetMomentContent(
    momentIds: string[],
  ): Promise<Map<string, { content_text: string; authorName: string | null }>> {
    const result = new Map<string, { content_text: string; authorName: string | null }>();

    if (momentIds.length === 0) return result;

    const { data, error } = await this.supabase
      .from('moments')
      .select('id, content_text, author:author_id ( display_name )')
      .in('id', momentIds);

    if (error || !data) return result;

    for (const row of data as unknown[]) {
      const r = row as {
        id: string;
        content_text?: string;
        author?: { display_name?: string } | null;
      };
      const text = (r.content_text ?? '').substring(0, MAX_MOMENT_CONTENT_LENGTH);
      result.set(r.id, {
        content_text: text,
        authorName: r.author?.display_name ?? null,
      });
    }

    return result;
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
        reason_category: dto.reason ?? undefined,
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

    // Only fetch essential fields, limit text size
    const MAX_BIO_LENGTH = 2000;
    const MAX_MOMENT_ANALYSIS_COUNT = 10;
    const MAX_MOMENT_ANALYSIS_TEXT = 1000;

    const profileText = [
      (u.bio_text ?? '').substring(0, MAX_BIO_LENGTH),
      (u.status_text ?? ''),
      (u.greeting_message ?? ''),
      (u.away_message ?? ''),
    ].join(' ');

    const { data: moments } = await this.supabase
      .from('moments')
      .select('content_text')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_MOMENT_ANALYSIS_COUNT);

    const momentRows = (moments ?? []) as unknown[];
    const momentText = momentRows
      .map((row) => {
        const obj = row as { content_text?: string };
        return (obj.content_text ?? '').substring(0, MAX_MOMENT_ANALYSIS_TEXT);
      })
      .join(' ');

    const fullText = (profileText + ' ' + momentText).toLowerCase();

    // Use pre-compiled module-level regexes
    const flags: string[] = [];
    for (const { keyword, regex } of DATING_REGEXES) {
      if (regex.test(fullText)) {
        flags.push(keyword);
      }
    }

    const uniqueFlags = [...new Set(flags)];
    if (uniqueFlags.length === 0) {
      return { riskScore: 0, flags: [] };
    }

    const totalKeywords = DATING_KEYWORDS.length;
    const hitRatio = uniqueFlags.length / totalKeywords;
    const bonus = (() => {
      if (uniqueFlags.length > 10) return 10;
      if (uniqueFlags.length > 5) return 20;
      return 0;
    })();
    const riskScore = Math.min(100, Math.round(hitRatio * 100 + bonus));

    return { riskScore, flags: uniqueFlags };
  }
}
