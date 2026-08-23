import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectChatService } from './direct-chat.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';

describe('DirectChatService', () => {
  let service: DirectChatService;
  let rpc: ReturnType<typeof vi.fn>;
  let maybeSingle: ReturnType<typeof vi.fn>;
  let safetyService: { getBlockedAndBlockerIds: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    rpc = vi.fn().mockResolvedValue({ data: ROOM_ID, error: null });
    maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: PARTNER_ID,
        profile_visibility: 'everyone',
        is_deleted: false,
      },
      error: null,
    });

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };
    const supabase = {
      from: vi.fn().mockReturnValue(query),
      rpc,
    };
    safetyService = {
      getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DirectChatService,
        { provide: SupabaseService, useValue: { getClient: () => supabase } },
        { provide: SafetyService, useValue: safetyService },
      ],
    }).compile();

    service = module.get(DirectChatService);
  });

  it('opens the atomic direct room for an existing visible unblocked user', async () => {
    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).resolves.toEqual({
      room_id: ROOM_ID,
    });
    expect(safetyService.getBlockedAndBlockerIds).toHaveBeenCalledWith(USER_ID);
    expect(rpc).toHaveBeenCalledWith('get_or_create_direct_chat', {
      p_user_id: USER_ID,
      p_partner_id: PARTNER_ID,
    });
  });

  it('rejects self chats before touching persistence', async () => {
    await expect(service.openDirectChat(USER_ID, USER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not reveal a room when the partner does not exist', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('treats soft-deleted partners as unavailable', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: PARTNER_ID, profile_visibility: 'everyone', is_deleted: true },
      error: null,
    });

    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserves hidden-profile privacy', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: PARTNER_ID, profile_visibility: 'hidden', is_deleted: false },
      error: null,
    });

    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserves VIP-only profile visibility for free users', async () => {
    maybeSingle
      .mockResolvedValueOnce({
        data: { id: PARTNER_ID, profile_visibility: 'vips_only', is_deleted: false },
        error: null,
      })
      .mockResolvedValueOnce({ data: { is_vip: false }, error: null });

    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('allows VIP users to open VIP-only profiles', async () => {
    maybeSingle
      .mockResolvedValueOnce({
        data: { id: PARTNER_ID, profile_visibility: 'vips_only', is_deleted: false },
        error: null,
      })
      .mockResolvedValueOnce({ data: { is_vip: true }, error: null });

    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).resolves.toEqual({
      room_id: ROOM_ID,
    });
  });

  it('fails closed if VIP entitlement cannot be verified', async () => {
    maybeSingle
      .mockResolvedValueOnce({
        data: { id: PARTNER_ID, profile_visibility: 'vips_only', is_deleted: false },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } });

    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when either participant has blocked the other', async () => {
    safetyService.getBlockedAndBlockerIds.mockResolvedValueOnce([PARTNER_ID]);
    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed when the safety relationship cannot be checked', async () => {
    safetyService.getBlockedAndBlockerIds.mockRejectedValueOnce(new Error('redis down'));
    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fails closed on datastore errors and never returns a guessed room id', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000' } });
    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects malformed room identifiers from the RPC', async () => {
    rpc.mockResolvedValueOnce({ data: '../other-room', error: null });
    await expect(service.openDirectChat(USER_ID, PARTNER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('deduplicates concurrent opens for the same unordered pair in this API process', async () => {
    let resolveRpc!: (value: { data: string; error: null }) => void;
    rpc.mockImplementationOnce(
      () =>
        new Promise<{ data: string; error: null }>((resolve) => {
          resolveRpc = resolve;
        }),
    );

    const first = service.openDirectChat(USER_ID, PARTNER_ID);
    const second = service.openDirectChat(USER_ID, PARTNER_ID);
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    resolveRpc({ data: ROOM_ID, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { room_id: ROOM_ID },
      { room_id: ROOM_ID },
    ]);
  });
});
