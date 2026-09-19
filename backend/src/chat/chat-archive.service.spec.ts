import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatArchiveService } from './chat-archive.service';

function listBuilder(result: { data: unknown[] | null; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.then.mockImplementation((resolve: (value: unknown) => void) =>
    resolve(result),
  );
  return builder;
}

function membershipBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

function updateBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.select.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

describe('ChatArchiveService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const roomId = '22222222-2222-4222-8222-222222222222';
  let from: ReturnType<typeof vi.fn>;
  let service: ChatArchiveService;

  beforeEach(() => {
    from = vi.fn();
    service = new ChatArchiveService({
      getClient: () => ({ from }),
    } as unknown as SupabaseService);
  });

  it('returns a bounded, de-duplicated list of archived room ids', async () => {
    const builder = listBuilder({
      data: [{ room_id: roomId }, { room_id: roomId }, { room_id: 'room-2' }],
      error: null,
    });
    from.mockReturnValue(builder);

    await expect(service.getArchivedRoomIds(userId)).resolves.toEqual([
      roomId,
      'room-2',
    ]);
    expect(from).toHaveBeenCalledWith('chat_room_members');
    expect(builder.eq).toHaveBeenCalledWith('user_id', userId);
    expect(builder.eq).toHaveBeenCalledWith('is_archived', true);
    expect(builder.order).toHaveBeenCalledWith('archived_at', {
      ascending: false,
    });
    expect(builder.limit).toHaveBeenCalledWith(500);
  });

  it('fails closed when archived membership lookup is unavailable', async () => {
    from.mockReturnValue(
      listBuilder({ data: null, error: { code: 'db-down' } }),
    );

    await expect(service.getArchivedRoomIds(userId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects archive mutations when the caller is not a room member', async () => {
    from.mockReturnValue(membershipBuilder({ data: null, error: null }));

    await expect(service.archiveRoom(userId, roomId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('makes repeated archive requests idempotent', async () => {
    from.mockReturnValue(
      membershipBuilder({
        data: { room_id: roomId, is_archived: true },
        error: null,
      }),
    );

    await expect(service.archiveRoom(userId, roomId)).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('archives only the authenticated membership row', async () => {
    const membership = membershipBuilder({
      data: { room_id: roomId, is_archived: false },
      error: null,
    });
    const update = updateBuilder({ data: { room_id: roomId }, error: null });
    from.mockReturnValueOnce(membership).mockReturnValueOnce(update);

    await service.archiveRoom(userId, roomId);

    expect(update.update).toHaveBeenCalledWith({
      is_archived: true,
      archived_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(update.eq).toHaveBeenCalledWith('room_id', roomId);
    expect(update.eq).toHaveBeenCalledWith('user_id', userId);
  });

  it('clears archived_at when restoring a chat', async () => {
    const membership = membershipBuilder({
      data: { room_id: roomId, is_archived: true },
      error: null,
    });
    const update = updateBuilder({ data: { room_id: roomId }, error: null });
    from.mockReturnValueOnce(membership).mockReturnValueOnce(update);

    await service.unarchiveRoom(userId, roomId);

    expect(update.update).toHaveBeenCalledWith({
      is_archived: false,
      archived_at: null,
    });
  });

  it('does not leak provider failures through archive mutations', async () => {
    const membership = membershipBuilder({
      data: { room_id: roomId, is_archived: false },
      error: null,
    });
    const update = updateBuilder({
      data: null,
      error: { message: 'secret database detail' },
    });
    from.mockReturnValueOnce(membership).mockReturnValueOnce(update);

    await expect(service.archiveRoom(userId, roomId)).rejects.toThrow(
      'Unable to update archived chat',
    );
  });
});
