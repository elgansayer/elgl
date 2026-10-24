import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SafetyService } from '../safety/safety.service';
import { SupabaseService } from '../supabase/supabase.service';

export type CorrectionVote = 'up' | 'down';

export interface CorrectionVoteResult {
  commentId: string;
  vote: string;
  upVotes: number;
  downVotes: number;
  userVote: CorrectionVote | null;
}

interface CorrectionRow {
  id: string;
  moment_id: string;
  user_id: string;
  correction_payload: unknown | null;
}

interface CorrectionVoteRpcRow {
  comment_id: string;
  user_vote: CorrectionVote | null;
  up_votes: number | string;
  down_votes: number | string;
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

interface CorrectionVoteRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
}

@Injectable()
export class CorrectionQualityService {
  private readonly logger = new Logger(CorrectionQualityService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  async vote(
    userId: string,
    momentId: string,
    commentId: string,
    vote: CorrectionVote,
  ): Promise<CorrectionVoteResult> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('moment_comments')
      .select('id, moment_id, user_id, correction_payload')
      .eq('id', commentId)
      .eq('moment_id', momentId)
      .single();

    const correction = data as CorrectionRow | null;
    if (error || !correction) {
      throw new NotFoundException('Correction not found');
    }
    if (!correction.correction_payload) {
      throw new BadRequestException('Only correction comments can be rated');
    }
    if (correction.user_id === userId) {
      throw new ForbiddenException('You cannot rate your own correction');
    }

    const blockedIds = await this.safetyService.getBlockedAndBlockerIds(userId);
    if (blockedIds.includes(correction.user_id)) {
      throw new ForbiddenException('You cannot rate this correction');
    }

    const rpcClient = client as unknown as CorrectionVoteRpcClient;
    const result = await rpcClient.rpc('rate_moment_correction', {
      p_user_id: userId,
      p_moment_id: momentId,
      p_comment_id: commentId,
      p_vote: vote,
    });

    const row = this.parseRpcRow(result.data, commentId);
    if (result.error || !row) {
      this.logger.error('Correction quality vote failed');
      throw new InternalServerErrorException('Unable to rate correction');
    }

    return {
      commentId,
      vote: row.user_vote ?? '',
      upVotes: row.up_votes,
      downVotes: row.down_votes,
      userVote: row.user_vote,
    };
  }

  private parseRpcRow(
    data: unknown,
    expectedCommentId: string,
  ): {
    user_vote: CorrectionVote | null;
    up_votes: number;
    down_votes: number;
  } | null {
    if (!Array.isArray(data) || data.length !== 1) return null;
    const candidate = data[0] as Partial<CorrectionVoteRpcRow>;
    if (candidate.comment_id !== expectedCommentId) return null;
    if (
      candidate.user_vote !== null &&
      candidate.user_vote !== 'up' &&
      candidate.user_vote !== 'down'
    ) {
      return null;
    }

    const upVotes = Number(candidate.up_votes);
    const downVotes = Number(candidate.down_votes);
    if (
      !Number.isSafeInteger(upVotes) ||
      upVotes < 0 ||
      !Number.isSafeInteger(downVotes) ||
      downVotes < 0
    ) {
      return null;
    }

    return {
      user_vote: candidate.user_vote ?? null,
      up_votes: upVotes,
      down_votes: downVotes,
    };
  }
}
