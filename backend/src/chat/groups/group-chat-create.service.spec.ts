import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GroupChatCreateService } from './group-chat-create.service';

const creatorId = '00000000-0000-4000-8000-000000000001';
const partnerId = '00000000-0000-4000-8000-000000000002';

function createHarness(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const supabase = { rpc };
  const supabaseService = { getClient: () => supabase };
  const systemMessageService = { publishToRoom: vi.fn().mockResolvedValue(undefined) };
  const service = new GroupChatCreateService(
    supabaseService as never,
    systemMessageService as never,
  );
  return { service, rpc, systemMessageService };
}

describe('GroupChatCreateService', () => {
  it('creates the room and memberships through the atomic database function', async () => {
    const room = {
      id: '00000000-0000-4000-8000-000000000099',
      type: 'group',
      name: 'Beginner French Grammar',
      description: null,
      topic: 'French grammar',
      interest_id: null,
      avatar_url: null,
      created_by: creatorId,
      is_archived: false,
    };
    const { service, rpc, systemMessageService } = createHarness({
      data: room,
      error: null,
    });

    const result = await service.create(creatorId, {
      name: ' Beginner French Grammar ',
      topic: ' French grammar ',
      memberIds: [partnerId],
    });

    expect(rpc).toHaveBeenCalledWith('create_group_chat_atomic', {
      p_creator_id: creatorId,
      p_name: 'Beginner French Grammar',
      p_description: null,
      p_topic: 'French grammar',
      p_interest_id: null,
      p_member_ids: [partnerId],
    });
    expect(result.member_count).toBe(2);
    expect(result.admin_id).toBe(creatorId);
    expect(systemMessageService.publishToRoom).toHaveBeenCalledWith(
      room.id,
      'group_created',
      expect.objectContaining({ actor_id: creatorId, member_ids: [partnerId] }),
    );
  });

  it('deduplicates invitees and removes the creator before the transaction', async () => {
    const { service, rpc } = createHarness({
      data: {
        id: '00000000-0000-4000-8000-000000000099',
        type: 'group',
        name: 'French',
      },
      error: null,
    });

    await service.create(creatorId, {
      name: 'French',
      memberIds: [creatorId, partnerId, partnerId],
    });

    expect(rpc).toHaveBeenCalledWith(
      'create_group_chat_atomic',
      expect.objectContaining({ p_member_ids: [partnerId] }),
    );
  });

  it('rejects requests that do not contain another partner', async () => {
    const { service, rpc } = createHarness({ data: null, error: null });
    await expect(
      service.create(creatorId, { name: 'French', memberIds: [creatorId] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps database block enforcement to a forbidden response', async () => {
    const { service } = createHarness({
      data: null,
      error: { code: '42501', message: 'A blocked user cannot be added' },
    });
    await expect(
      service.create(creatorId, { name: 'French', memberIds: [partnerId] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
