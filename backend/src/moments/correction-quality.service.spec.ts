import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { vi } from 'vitest';
import { SafetyService } from '../safety/safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CorrectionQualityService } from './correction-quality.service';

describe('CorrectionQualityService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const authorId = '22222222-2222-4222-8222-222222222222';
  const momentId = '33333333-3333-4333-8333-333333333333';
  const commentId = '44444444-4444-4444-8444-444444444444';

  let service: CorrectionQualityService;
  let single: ReturnType<typeof vi.fn>;
  let rpc: ReturnType<typeof vi.fn>;
  let getBlockedAndBlockerIds: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    single = vi.fn().mockResolvedValue({
      data: {
        id: commentId,
        moment_id: momentId,
        user_id: authorId,
        correction_payload: {
          original: 'I go yesterday',
          corrected: 'I went yesterday',
        },
      },
      error: null,
    });
    rpc = vi.fn().mockResolvedValue({
      data: [
        {
          comment_id: commentId,
          user_vote: 'up',
          up_votes: 3,
          down_votes: 1,
        },
      ],
      error: null,
    });
    getBlockedAndBlockerIds = vi.fn().mockResolvedValue([]);

    const secondEq = vi.fn().mockReturnValue({ single });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const select = vi.fn().mockReturnValue({ eq: firstEq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from, rpc };

    service = new CorrectionQualityService(
      { getClient: vi.fn().mockReturnValue(client) } as unknown as SupabaseService,
      { getBlockedAndBlockerIds } as unknown as SafetyService,
    );
  });

  it('returns server-authoritative counts and current vote', async () => {
    await expect(service.vote(userId, momentId, commentId, 'up')).resolves.toEqual({
      commentId,
      vote: 'up',
      upVotes: 3,
      downVotes: 1,
      userVote: 'up',
    });

    expect(rpc).toHaveBeenCalledWith('rate_moment_correction', {
      p_user_id: userId,
      p_moment_id: momentId,
      p_comment_id: commentId,
      p_vote: 'up',
    });
  });

  it('rejects missing corrections without invoking the mutation', async () => {
    single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    await expect(service.vote(userId, momentId, commentId, 'up')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects ratings on ordinary comments', async () => {
    single.mockResolvedValueOnce({
      data: {
        id: commentId,
        moment_id: momentId,
        user_id: authorId,
        correction_payload: null,
      },
      error: null,
    });

    await expect(service.vote(userId, momentId, commentId, 'down')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects self-ratings', async () => {
    single.mockResolvedValueOnce({
      data: {
        id: commentId,
        moment_id: momentId,
        user_id: userId,
        correction_payload: { original: 'a', corrected: 'b' },
      },
      error: null,
    });

    await expect(service.vote(userId, momentId, commentId, 'up')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects ratings across an active block boundary', async () => {
    getBlockedAndBlockerIds.mockResolvedValueOnce([authorId]);

    await expect(service.vote(userId, momentId, commentId, 'up')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the atomic mutation fails', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'database unavailable' } });

    await expect(service.vote(userId, momentId, commentId, 'up')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('fails closed on malformed aggregate data', async () => {
    rpc.mockResolvedValueOnce({
      data: [
        {
          comment_id: commentId,
          user_vote: 'up',
          up_votes: -1,
          down_votes: 0,
        },
      ],
      error: null,
    });

    await expect(service.vote(userId, momentId, commentId, 'up')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
