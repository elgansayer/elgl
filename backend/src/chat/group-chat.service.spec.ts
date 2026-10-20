import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupChatService, GroupChatRecord } from './group-chat.service';

const room: GroupChatRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'group',
  title: 'Study group',
  topic: null,
  avatar_url: null,
  admin_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  max_members: 19,
  member_count: 2,
  created_at: '2026-08-21T00:00:00.000Z',
};

describe('GroupChatService', () => {
  const creatorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const memberId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let rpc: ReturnType<typeof vi.fn>;
  let publishToRoom: ReturnType<typeof vi.fn>;
  let blocked: ReturnType<typeof vi.fn>;
  let service: GroupChatService;

  beforeEach(() => {
    rpc = vi.fn();
    publishToRoom = vi.fn().mockResolvedValue(undefined);
    blocked = vi.fn().mockResolvedValue([]);
    service = new GroupChatService(
      { getClient: () => ({ rpc }) } as never,
      { getBlockedAndBlockerIds: blocked } as never,
      { publishToRoom } as never,
    );
  });

  it('creates a group through the atomic database function', async () => {
    rpc.mockResolvedValue({ data: room.id, error: null });
    vi.spyOn(service, 'get').mockResolvedValue(room);

    await expect(
      service.create(creatorId, { name: '  Study group  ', memberIds: [memberId] }),
    ).resolves.toEqual(room);

    expect(rpc).toHaveBeenCalledWith('create_group_chat', {
      p_creator_id: creatorId,
      p_title: 'Study group',
      p_member_ids: [memberId],
    });
    expect(publishToRoom).toHaveBeenCalledWith(room.id, 'groupCreated', {
      actorId: creatorId,
      memberCount: 2,
    });
  });

  it('rejects blocked participants before creating a room', async () => {
    blocked.mockResolvedValue([memberId]);

    await expect(
      service.create(creatorId, { name: 'Study group', memberIds: [memberId] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps concurrent capacity failures to a client error', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'group_capacity_exceeded', code: '22023' },
    });

    await expect(
      service.addMembers(creatorId, room.id, { memberIds: [memberId] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires at least one other participant', async () => {
    await expect(
      service.create(creatorId, { name: 'Study group', memberIds: [creatorId] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not publish to a deleted room when the final member leaves', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(service.leave(creatorId, room.id)).resolves.toEqual({ deleted: true });
    expect(publishToRoom).not.toHaveBeenCalled();
  });
});
