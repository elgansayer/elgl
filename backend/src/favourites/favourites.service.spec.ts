import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { SupabaseService } from '../supabase/supabase.service';

const userId = '00000000-0000-4000-8000-0000000000a1';
const messageId = '00000000-0000-4000-8000-0000000000b1';
const favouriteId = '00000000-0000-4000-8000-0000000000c1';

interface InsertClient {
  insert: ReturnType<typeof vi.fn>;
  service: FavouritesService;
}

function serviceWithInsertResult(result: {
  error: { code?: unknown; message?: string } | null;
}): InsertClient {
  const insert = vi.fn().mockResolvedValue(result);
  const client = { from: vi.fn().mockReturnValue({ insert }) };
  const service = new FavouritesService({
    getClient: vi.fn().mockReturnValue(client),
  } as unknown as SupabaseService);
  return { insert, service };
}

function loggedText(...spies: ReturnType<typeof vi.spyOn>[]): string {
  return JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
}

describe('FavouritesService addFavourite', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('supplies only the message identity so the database rebuilds the snapshot', async () => {
    const { insert, service } = serviceWithInsertResult({ error: null });

    await expect(
      service.addFavourite(userId, {
        message_id: messageId,
        note_text: 'Useful phrase',
      }),
    ).resolves.toEqual({ success: true });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      user_id: userId,
      item_type: 'message',
      item_payload: { id: messageId },
      notes: 'Useful phrase',
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('stores a null note when none is supplied', async () => {
    const { insert, service } = serviceWithInsertResult({ error: null });

    await service.addFavourite(userId, { message_id: messageId });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null }),
    );
  });

  it('treats a lost unique-constraint race as an idempotent success', async () => {
    const { service } = serviceWithInsertResult({
      error: { code: '23505', message: 'duplicate key value' },
    });

    await expect(
      service.addFavourite(userId, { message_id: messageId }),
    ).resolves.toEqual({ success: true });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps concurrent retries of the same bookmark idempotent', async () => {
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: '23505' } });
    const service = new FavouritesService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    const results = await Promise.all([
      service.addFavourite(userId, { message_id: messageId }),
      service.addFavourite(userId, { message_id: messageId }),
    ]);

    expect(results).toEqual([{ success: true }, { success: true }]);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a message the user cannot access', '42501'],
    ['a message that does not exist', '23503'],
  ])(
    'reports %s as the same not-found response so identifiers cannot be probed',
    async (_label, code) => {
      const { service } = serviceWithInsertResult({
        error: {
          code,
          message: 'Cannot favourite a message outside your rooms',
        },
      });

      const failure = await service
        .addFavourite(userId, { message_id: messageId })
        .catch((caught: unknown) => caught);

      expect(failure).toBeInstanceOf(NotFoundException);
      expect((failure as NotFoundException).message).toBe('Message not found');
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'favourites.request_rejected',
          operation: 'add',
          code,
          userId,
          messageId,
        }),
      );
    },
  );

  it.each(['22023', '23502'])(
    'rejects an unusable message identifier (%s) as a bad request',
    async (code) => {
      const { service } = serviceWithInsertResult({ error: { code } });

      await expect(
        service.addFavourite(userId, { message_id: messageId }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addFavourite(userId, { message_id: messageId }),
      ).rejects.toThrow('Invalid message identifier');
    },
  );

  it('rejects an over-long note at the database boundary as a bad request', async () => {
    const { service } = serviceWithInsertResult({ error: { code: '22001' } });

    await expect(
      service.addFavourite(userId, { message_id: messageId }),
    ).rejects.toThrow('Favourite note must not exceed 500 characters');
  });

  it('maps unexpected provider failures to an opaque 500 without leaking details', async () => {
    const privateNote = 'my private revision note';
    const { service } = serviceWithInsertResult({
      error: {
        code: 'PGRST301',
        message: `Key (notes)=(${privateNote}) violates something`,
      },
    });

    const failure = await service
      .addFavourite(userId, { message_id: messageId, note_text: privateNote })
      .catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(InternalServerErrorException);
    expect((failure as InternalServerErrorException).message).toBe(
      'Failed to add favourite',
    );
    expect(error).toHaveBeenCalledWith({
      event: 'favourites.provider_failure',
      operation: 'add',
      code: 'PGRST301',
      userId,
    });
    expect(loggedText(warn, error)).not.toContain(privateNote);
  });

  it.each([
    ['a free-text code', 'something went wrong with row 7'],
    ['a missing code', undefined],
    ['a non-string code', 500],
  ])('never logs %s from the provider', async (_label, code) => {
    const { service } = serviceWithInsertResult({
      error: { code, message: 'secret provider detail' },
    });

    await expect(
      service.addFavourite(userId, { message_id: messageId }),
    ).rejects.toThrow(InternalServerErrorException);

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown' }),
    );
    expect(loggedText(error)).not.toContain('secret provider detail');
    expect(loggedText(error)).not.toContain('something went wrong');
  });
});

describe('FavouritesService removeFavourite', () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function serviceWithDeleteResult(result: {
    error: { code?: unknown; message?: string } | null;
  }) {
    const eqUser = vi.fn().mockResolvedValue(result);
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const remove = vi.fn().mockReturnValue({ eq: eqId });
    const from = vi.fn().mockReturnValue({ delete: remove });
    const service = new FavouritesService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);
    return { service, from, eqId, eqUser };
  }

  it('deletes only the favourite owned by the authenticated user', async () => {
    const { service, from, eqId, eqUser } = serviceWithDeleteResult({
      error: null,
    });

    await expect(service.removeFavourite(userId, favouriteId)).resolves.toEqual(
      { success: true },
    );

    expect(from).toHaveBeenCalledWith('favourites');
    expect(eqId).toHaveBeenCalledWith('id', favouriteId);
    expect(eqUser).toHaveBeenCalledWith('user_id', userId);
  });

  it('succeeds when the bookmark is already gone so retries are safe', async () => {
    const { service } = serviceWithDeleteResult({ error: null });

    await expect(service.removeFavourite(userId, favouriteId)).resolves.toEqual(
      { success: true },
    );
    await expect(service.removeFavourite(userId, favouriteId)).resolves.toEqual(
      { success: true },
    );
  });

  it('maps provider failures to an opaque 500 and logs only a sanitised code', async () => {
    const { service } = serviceWithDeleteResult({
      error: { code: '57014', message: 'canceling statement for private row' },
    });

    await expect(service.removeFavourite(userId, favouriteId)).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(service.removeFavourite(userId, favouriteId)).rejects.toThrow(
      'Failed to remove favourite',
    );

    expect(error).toHaveBeenCalledWith({
      event: 'favourites.provider_failure',
      operation: 'remove',
      code: '57014',
      userId,
    });
    expect(loggedText(error)).not.toContain('private row');
  });
});

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
    const secureRead = vi
      .spyOn(service, 'getStarredMessages')
      .mockResolvedValue({
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
    const logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
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
    expect(JSON.stringify(logged.mock.calls)).not.toContain(
      'provider detail must not escape',
    );
    logged.mockRestore();
  });

  describe('provider failures', () => {
    let error: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const favouriteRow = {
      id: 'fav-1',
      user_id: 'user-1',
      message_id: 'msg-1',
      item_type: 'message',
      item_payload: { id: 'msg-1', text_content: 'private message text' },
      notes: 'private note',
      created_at: '2026-08-20T00:00:00Z',
    };

    function clientFor(options: {
      favourites?: { data: unknown; error: unknown };
      messages?: { data: unknown; error: unknown };
      members?: { data: unknown; error: unknown };
    }) {
      return {
        from: vi.fn((table: string) => {
          if (table === 'favourites') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      range: vi.fn().mockResolvedValue(
                        options.favourites ?? {
                          data: [favouriteRow],
                          error: null,
                        },
                      ),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'chat_messages') {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue(
                  options.messages ?? {
                    data: [
                      {
                        id: 'msg-1',
                        room_id: 'room-1',
                        deleted_for_user_ids: null,
                      },
                    ],
                    error: null,
                  },
                ),
              }),
            };
          }
          if (table === 'chat_room_members') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue(
                    options.members ?? {
                      data: [{ room_id: 'room-1' }],
                      error: null,
                    },
                  ),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
      };
    }

    function serviceFor(client: ReturnType<typeof clientFor>) {
      return new FavouritesService({
        getClient: vi.fn().mockReturnValue(client),
      } as unknown as SupabaseService);
    }

    it.each([
      [
        'listing',
        {
          favourites: {
            data: null,
            error: { code: '57014', message: 'private note' },
          },
        },
        'Failed to load starred messages',
        'list',
        '57014',
      ],
      [
        'message visibility',
        {
          messages: {
            data: null,
            error: { code: '08006', message: 'private message text' },
          },
        },
        'Failed to verify starred message visibility',
        'verify_visibility',
        '08006',
      ],
      [
        'room membership',
        {
          members: {
            data: null,
            error: { code: 'PGRST000', message: 'private note' },
          },
        },
        'Failed to verify starred message membership',
        'verify_membership',
        'PGRST000',
      ],
    ])(
      'fails closed and logs a sanitised %s failure',
      async (_label, options, thrownMessage, operation, code) => {
        const service = serviceFor(clientFor(options));

        await expect(
          service.getStarredMessages('user-1', 50, 0),
        ).rejects.toThrow(thrownMessage);

        expect(error).toHaveBeenCalledWith({
          event: 'favourites.provider_failure',
          operation,
          code,
          userId: 'user-1',
        });
        const logged = loggedText(error);
        expect(logged).not.toContain('private message text');
        expect(logged).not.toContain('private note');
      },
    );

    it('omits a saved item whose room membership has ended', async () => {
      const service = serviceFor(
        clientFor({ members: { data: [], error: null } }),
      );

      await expect(
        service.getStarredMessages('user-1', 50, 0),
      ).resolves.toEqual({
        items: [],
        has_more: false,
        next_offset: null,
      });
      expect(error).not.toHaveBeenCalled();
    });

    it('omits a saved item the user deleted for themselves', async () => {
      const service = serviceFor(
        clientFor({
          messages: {
            data: [
              {
                id: 'msg-1',
                room_id: 'room-1',
                deleted_for_user_ids: ['user-1'],
              },
            ],
            error: null,
          },
        }),
      );

      await expect(
        service.getStarredMessages('user-1', 50, 0),
      ).resolves.toEqual({
        items: [],
        has_more: false,
        next_offset: null,
      });
    });
  });
});
