import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectConversationService } from './direct-conversation.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('DirectConversationService', () => {
  const rpc = vi.fn();
  const supabaseService = {
    getClient: vi.fn(() => ({ rpc })),
  } as unknown as SupabaseService;
  const service = new DirectConversationService(supabaseService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the canonical room id from the atomic RPC', async () => {
    rpc.mockResolvedValue({ data: 'room-123', error: null });

    await expect(service.openOrCreate('actor', 'target')).resolves.toEqual({
      room_id: 'room-123',
    });
    expect(rpc).toHaveBeenCalledWith('open_or_create_direct_conversation', {
      p_actor_id: 'actor',
      p_target_user_id: 'target',
    });
  });

  it('rejects self conversations before hitting storage', async () => {
    await expect(service.openOrCreate('same', 'same')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['direct_conversation_blocked', ForbiddenException],
    ['direct_conversation_message_restricted', ForbiddenException],
    ['direct_conversation_actor_unavailable', ForbiddenException],
    ['direct_conversation_target_unavailable', NotFoundException],
  ])('maps %s to a safe HTTP exception', async (message, ExceptionType) => {
    rpc.mockResolvedValue({ data: null, error: { message, details: '' } });

    await expect(
      service.openOrCreate('actor', 'target'),
    ).rejects.toBeInstanceOf(ExceptionType);
  });

  it('fails closed for storage errors without leaking provider details', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'database secret detail', details: 'internal host' },
    });

    await expect(
      service.openOrCreate('actor', 'target'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects malformed successful RPC responses', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(
      service.openOrCreate('actor', 'target'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
