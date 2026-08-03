import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ReportUserDto } from './dto/report-user.dto';
import { ModerationActionDto } from './dto/moderation-action.dto';

@Injectable()
export class ModerationService {
  private readonly supabase: ReturnType<SupabaseService['getClient']>;

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
  }

  async getItems(type: 'moment' | 'profile', status?: string) {
    let query = this.supabase
      .from('reports')
      .select(
        `
        id,
        status,
        reason,
        created_at,
        reporter_id,
        reported_user_id,
        moment_id,
        description,
        reporter:reporter_id ( id, display_name ),
        reported_user:reported_user_id ( id, display_name )
      `,
      )
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new NotFoundException('Failed to fetch moderation items');
    }

    return (data ?? []).map((item: any) => ({
      id: item.id,
      type,
      status: item.status,
      created_at: item.created_at,
      reason: item.reason,
      reporter: item.reporter,
      reported_user: item.reported_user,
      moment_content: item.moment_id ? undefined : undefined,
    }));
  }

  async reportUser(dto: ReportUserDto) {
    const { data, error } = await this.supabase.from('reports').insert({
      reported_user_id: dto.reportedUserId,
      reason: dto.reason,
      description: dto.description,
      type: 'profile',
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
        reason: dto.reason ?? null,
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
      .select('display_name, bio_text, target_languages, native_language')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new NotFoundException('user not found');
    }

    const combinedText = [
      userData.display_name ?? '',
      userData.bio_text ?? '',
      userData.native_language ?? '',
      userData.target_languages ? userData.target_languages.join(' ') : '',
    ].join(' ');

    const { data: moments } = await this.supabase
      .from('moments')
      .select('content_text')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const momentText = (moments ?? [])
      .map((m) => m.content_text ?? '')
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
    ];

    const flags: string[] = [];
    for (const flag of datingFlags) {
      if (fullText.includes(flag)) {
        flags.push(flag);
      }
    }

    const riskScore = Math.min(
      100,
      Math.round((flags.length / datingFlags.length) * 100),
    );

    return { riskScore, flags: [...new Set(flags)] };
  }
}
