import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
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
  momentAuthorName?: string | null;
}

export interface ModerationDegradedResponse {
  success: boolean;
  error?: string;
}

const DATING_FLAGS: ReadonlyArray<string> = [
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
] as const;

const DATING_REGEXPS: ReadonlyArray<RegExp> = [...new Set(DATING_FLAGS)].map(
  (flag) => {
    const escaped = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i');
  },
);

@Injectable()
export class ModerationService {
  private readonly supabase: ReturnType<SupabaseService['getClient']>;

  constructor(
    @InjectPinoLogger(ModerationService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {
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

    // DB-level filtering: profile type requires reported_user_id, moment type requires reported_moment_id
    if (type === 'profile') {
      query = query.not('reported_user_id', 'is', null);
    } else {
      query = query.not('reported_moment_id', 'is', null);
    }

    try {
      const { data, error } = await query;

      if (error) {
        this.logger.warn({ error }, 'Failed to fetch moderation items');
        return [];
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

      // Batch-fetch moment content for all moment items in a single query
      if (type !== 'profile') {
        const momentIds = items
          .map((item) => item.reportedMomentId)
          .filter((id): id is string => id != null);

        if (momentIds.length > 0) {
          const momentContentMap = await this.batchGetMomentContent(momentIds);
          for (const item of items) {
            if (item.reportedMomentId) {
              const moment = momentContentMap.get(item.reportedMomentId);
              if (moment) {
                item.moment_content = moment.content_text;
                item.momentAuthorName = moment.authorName;
              }
            }
          }
        }
      }

      return items;
    } catch (err) {
      this.logger.warn(
        { err },
        'Failed to fetch moderation items, returning empty result',
      );
      return [];
    }
  }

  private async batchGetMomentContent(
    momentIds: string[],
  ): Promise<Map<string, { content_text: string; authorName: string | null }>> {
    const result = new Map<
      string,
      { content_text: string; authorName: string | null }
    >();

    const { data, error } = await this.supabase
      .from('moments')
      .select('id, content_text, author_id, author:author_id ( display_name )')
      .in('id', momentIds);

    if (error || !data) {
      return result;
    }

    const rows = data as Array<{
      id: string;
      content_text: string;
      author: { display_name?: string } | null;
    }>;

    for (const row of rows) {
      result.set(row.id, {
        content_text: row.content_text ?? '',
        authorName: row.author?.display_name ?? null,
      });
    }

    return result;
  }

  async reportUser(
    reporterId: string,
    dto: ReportUserDto,
  ): Promise<ModerationDegradedResponse> {
    try {
      const { error } = await this.supabase.from('reports').insert({
        reporter_id: reporterId,
        reported_user_id: dto.reportedUserId,
        reason_category: dto.reasonCategory,
        description: dto.description ?? null,
        status: 'pending',
      });

      if (error) {
        this.logger.warn({ error }, 'Failed to create report');
        return { success: false, error: 'Failed to create report' };
      }

      return { success: true };
    } catch (err) {
      this.logger.warn({ err }, 'Failed to create report, degraded');
      return { success: false, error: 'Service temporarily unavailable' };
    }
  }

  async approveItem(dto: ModerationActionDto): Promise<ModerationDegradedResponse> {
    try {
      const { error } = await this.supabase
        .from('reports')
        .update({ status: 'approved' })
        .eq('id', dto.itemId);

      if (error) {
        this.logger.warn({ error, itemId: dto.itemId }, 'Failed to approve moderation item');
        return { success: false, error: 'Failed to approve item' };
      }

      return { success: true };
    } catch (err) {
      this.logger.warn({ err }, 'Failed to approve item, degraded');
      return { success: false, error: 'Service temporarily unavailable' };
    }
  }

  async rejectItem(dto: ModerationActionDto): Promise<ModerationDegradedResponse> {
    try {
      const { error } = await this.supabase
        .from('reports')
        .update({
          status: 'rejected',
          reason_category: dto.reason ?? undefined,
        })
        .eq('id', dto.itemId);

      if (error) {
        this.logger.warn({ error, itemId: dto.itemId }, 'Failed to reject moderation item');
        return { success: false, error: 'Failed to reject item' };
      }

      return { success: true };
    } catch (err) {
      this.logger.warn({ err }, 'Failed to reject item, degraded');
      return { success: false, error: 'Service temporarily unavailable' };
    }
  }

  async analyseUserForDatingBehaviour(
    userId: string,
  ): Promise<{ riskScore: number; flags: string[] }> {
    try {
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select(
          'display_name, bio_text, target_languages, native_language, status_text, greeting_message, away_message',
        )
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        this.logger.warn({ userId }, 'User not found for analysis');
        return { riskScore: 0, flags: [] };
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

      const flags: string[] = [];
      const uniqueFlags = [...new Set(DATING_FLAGS)];

      for (let i = 0; i < uniqueFlags.length; i++) {
        if (DATING_REGEXPS[i].test(fullText)) {
          flags.push(uniqueFlags[i]);
        }
      }

      const matchedFlags = [...new Set(flags)];
      const hitRatio = matchedFlags.length / uniqueFlags.length;
      const riskScore = Math.min(
        100,
        Math.round(
          hitRatio * 100 +
            (matchedFlags.length > 5 ? 20 : 0) +
            (matchedFlags.length > 10 ? 10 : 0),
        ),
      );

      return { riskScore, flags: matchedFlags };
    } catch (err) {
      this.logger.warn({ err, userId }, 'Failed to analyse user, degraded');
      return { riskScore: 0, flags: [] };
    }
  }
}
