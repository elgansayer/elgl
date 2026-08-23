import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../supabase/supabase.service';
import { ChatFoldersService } from './chat-folders.service';

function thenable(result: unknown) {
  return {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
  };
}

describe('ChatFoldersService', () => {
  it('archives only the authenticated membership and is retry-safe', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { room_id: '11111111-1111-4111-8111-111111111111' },
      error: null,
    });
    const select = vi.fn(() => ({ maybeSingle }));
    const eqRoom = vi.fn(() => ({ select }));
    const eqUser = vi.fn(() => ({ eq: eqRoom }));
    const update = vi.fn(() => ({ eq: eqUser }));
    const client = { from: vi.fn(() => ({ update })) };
    const service = new ChatFoldersService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await service.archiveRoom(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(update).toHaveBeenCalledWith({ is_archived: true });
    expect(eqUser).toHaveBeenCalledWith(
      'user_id',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(eqRoom).toHaveBeenCalledWith(
      'room_id',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('does not reveal rooms the caller is not a member of', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({ maybeSingle })),
            })),
          })),
        })),
      })),
    };
    const service = new ChatFoldersService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(
      service.archiveRoom(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails closed when archive persistence is unavailable', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX000' },
    });
    const client = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({ maybeSingle })),
            })),
          })),
        })),
      })),
    };
    const service = new ChatFoldersService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(
      service.unarchiveRoom(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('loads only bounded rooms belonging to the selected folder', async () => {
    const membershipLimit = vi.fn(() =>
      thenable({
        data: [
          { room_id: '11111111-1111-4111-8111-111111111111' },
          { room_id: '22222222-2222-4222-8222-222222222222' },
        ],
        error: null,
      }),
    );
    const membershipFieldEq = vi.fn(() => ({ limit: membershipLimit }));
    const membershipUserEq = vi.fn(() => ({ eq: membershipFieldEq }));
    const membershipSelect = vi.fn(() => ({ eq: membershipUserEq }));

    const roomLimit = vi.fn(() =>
      thenable({
        data: [
          { id: '22222222-2222-4222-8222-222222222222', title: 'Second' },
          { id: '11111111-1111-4111-8111-111111111111', title: 'First' },
        ],
        error: null,
      }),
    );
    const roomIn = vi.fn(() => ({ limit: roomLimit }));
    const roomSelect = vi.fn(() => ({ in: roomIn }));

    const client = {
      from: vi.fn((table: string) =>
        table === 'chat_room_members'
          ? { select: membershipSelect }
          : { select: roomSelect },
      ),
    };
    const service = new ChatFoldersService({
      getClient: () => client,
    } as unknown as SupabaseService);

    const rooms = await service.getArchivedRooms(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );

    expect(membershipFieldEq).toHaveBeenCalledWith('is_archived', true);
    expect(membershipLimit).toHaveBeenCalledWith(200);
    expect(roomIn).toHaveBeenCalledWith('id', [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(rooms.map((room) => room.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('does not query room details for an empty folder', async () => {
    const membershipLimit = vi.fn(() => thenable({ data: [], error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ limit: membershipLimit })),
          })),
        })),
      })),
    };
    const service = new ChatFoldersService({
      getClient: () => client,
    } as unknown as SupabaseService);

    await expect(
      service.getHiddenRooms('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ).resolves.toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });
});
