import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SafetyService } from '../../safety/safety.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { DirectConversationService } from './direct-conversation.service';

interface QueryResponse {
  data?: unknown;
  error?: { message: string } | null;
}

function makeQuery(response: QueryResponse) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'upsert']) {
    query[method] = vi.fn(() => query);
  }
  query['maybeSingle'] = vi.fn(() => Promise.resolve(response));
  query['then'] = (
    resolve: (value: QueryResponse) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);
  return query as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: unknown;
  };
}

describe('DirectConversationService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const targetUserId = '22222222-2222-4222-8222-222222222222';
  let from: ReturnType<typeof vi.fn>;
  let safetyService: { getBlockedAndBlockerIds: ReturnType<typeof vi.fn> };
  let service: DirectConversationService;

  beforeEach(() => {
    from = vi.fn();
    safetyService = {
      getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
    };
    service = new DirectConversationService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      safetyService as unknown as SafetyService,
    );
  });

  it('rejects self conversations before touching storage', async () => {
    await expect(service.openOrCreate(userId, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects conversations with blocked users', async () => {
    safetyService.getBlockedAndBlockerIds.mockResolvedValue([targetUserId]);

    await expect(
      service.openOrCreate(userId, targetUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects targets whose account deletion is pending', async () => {
    from.mockReturnValueOnce(
      makeQuery({
        data: { id: targetUserId, is_deletion_pending: true },
        error: null,
      }),
    );

    await expect(
      service.openOrCreate(userId, targetUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reuses an existing two-member direct room and ignores two-member groups', async () => {
    const directRoomId = '33333333-3333-4333-8333-333333333333';
    const groupRoomId = '44444444-4444-4444-8444-444444444444';
    const queries = [
      makeQuery({ data: { id: targetUserId, is_deletion_pending: false }, error: null }),
      makeQuery({ data: [{ room_id: directRoomId }, { room_id: groupRoomId }], error: null }),
      makeQuery({ data: [{ room_id: directRoomId }, { room_id: groupRoomId }], error: null }),
      makeQuery({
        data: [
          { id: directRoomId, type: 'direct' },
          { id: groupRoomId, type: 'group' },
        ],
        error: null,
      }),
      makeQuery({
        data: [
          { room_id: directRoomId, user_id: userId },
          { room_id: directRoomId, user_id: targetUserId },
        ],
        error: null,
      }),
    ];
    from.mockImplementation(() => queries.shift());

    await expect(service.openOrCreate(userId, targetUserId)).resolves.toBe(
      directRoomId,
    );
    expect(queries).toHaveLength(0);
  });

  it('uses the same deterministic room id for concurrent-safe retries', async () => {
    const firstRoomUpsert = makeQuery({ error: null });
    const firstMemberUpsert = makeQuery({ error: null });
    const secondRoomUpsert = makeQuery({ error: null });
    const secondMemberUpsert = makeQuery({ error: null });
    const queries = [
      makeQuery({ data: { id: targetUserId, is_deletion_pending: false }, error: null }),
      makeQuery({ data: [], error: null }),
      firstRoomUpsert,
      firstMemberUpsert,
      makeQuery({ data: { id: targetUserId, is_deletion_pending: false }, error: null }),
      makeQuery({ data: [], error: null }),
      secondRoomUpsert,
      secondMemberUpsert,
    ];
    from.mockImplementation(() => queries.shift());

    const first = await service.openOrCreate(userId, targetUserId);
    const second = await service.openOrCreate(userId, targetUserId);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(firstRoomUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: first, type: 'direct' }),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    expect(firstMemberUpsert.upsert).toHaveBeenCalledWith(
      [
        { room_id: first, user_id: userId },
        { room_id: first, user_id: targetUserId },
      ],
      { onConflict: 'room_id,user_id', ignoreDuplicates: true },
    );
  });
});
