import { FavouritesService } from './favourites.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('FavouritesService starred messages', () => {
  it('returns only currently visible starred messages and exposes the next offset', async () => {
    const favouritesRange = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'fav-visible',
          user_id: 'user-1',
          message_id: 'msg-visible',
          item_type: 'message',
          item_payload: { id: 'msg-visible', text_content: 'hello' },
          notes: null,
          created_at: '2026-08-20T00:00:00Z',
        },
        {
          id: 'fav-deleted',
          user_id: 'user-1',
          message_id: 'msg-deleted',
          item_type: 'message',
          item_payload: { id: 'msg-deleted', text_content: 'gone' },
          notes: null,
          created_at: '2026-08-19T00:00:00Z',
        },
        {
          id: 'fav-next-page',
          user_id: 'user-1',
          message_id: 'msg-next',
          item_type: 'message',
          item_payload: { id: 'msg-next' },
          notes: null,
          created_at: '2026-08-18T00:00:00Z',
        },
      ],
      error: null,
    });
    const favouritesOrder = vi.fn().mockReturnValue({ range: favouritesRange });
    const favouritesType = vi.fn().mockReturnValue({ order: favouritesOrder });
    const favouritesUser = vi.fn().mockReturnValue({ eq: favouritesType });
    const favouritesSelect = vi.fn().mockReturnValue({ eq: favouritesUser });

    const messagesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'msg-visible',
          room_id: 'room-1',
          deleted_for_user_ids: null,
        },
      ],
      error: null,
    });
    const messagesSelect = vi.fn().mockReturnValue({ in: messagesIn });

    const membershipIn = vi.fn().mockResolvedValue({
      data: [{ room_id: 'room-1' }],
      error: null,
    });
    const membershipUser = vi.fn().mockReturnValue({ in: membershipIn });
    const membershipSelect = vi.fn().mockReturnValue({ eq: membershipUser });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'favourites') return { select: favouritesSelect };
        if (table === 'chat_messages') return { select: messagesSelect };
        if (table === 'chat_room_members') return { select: membershipSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const supabaseService = {
      getClient: vi.fn().mockReturnValue(client),
    } as unknown as SupabaseService;
    const service = new FavouritesService(supabaseService);

    await expect(service.getStarredMessages('user-1', 2, 0)).resolves.toEqual({
      items: [expect.objectContaining({ id: 'fav-visible' })],
      has_more: true,
      next_offset: 2,
    });

    expect(favouritesRange).toHaveBeenCalledWith(0, 2);
    expect(messagesIn).toHaveBeenCalledWith('id', [
      'msg-visible',
      'msg-deleted',
    ]);
    expect(membershipIn).toHaveBeenCalledWith('room_id', ['room-1']);
  });

  it('applies current visibility checks to compatibility reads', async () => {
    const service = new FavouritesService({} as SupabaseService);
    const secureRead = vi.spyOn(service, 'getStarredMessages').mockResolvedValue({
      items: [{ id: 'fav-visible' }],
      has_more: false,
      next_offset: null,
    });

    await expect(service.getUserFavourites('user-1')).resolves.toEqual([
      { id: 'fav-visible' },
    ]);
    expect(secureRead).toHaveBeenCalledWith('user-1', 100, 0);
  });

  it('fails closed when current message visibility cannot be verified', async () => {
    const favouritesRange = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'fav-1',
          user_id: 'user-1',
          message_id: 'msg-1',
          item_type: 'message',
          item_payload: { id: 'msg-1' },
          notes: null,
          created_at: '2026-08-20T00:00:00Z',
        },
      ],
      error: null,
    });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'favourites') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({ range: favouritesRange }),
                }),
              }),
            }),
          };
        }
        if (table === 'chat_messages') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'provider detail must not escape' },
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const service = new FavouritesService({
      getClient: vi.fn().mockReturnValue(client),
    } as unknown as SupabaseService);

    await expect(service.getStarredMessages('user-1', 50, 0)).rejects.toThrow(
      'Failed to verify starred message visibility',
    );
  });
});
