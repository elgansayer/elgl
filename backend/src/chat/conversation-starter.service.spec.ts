import type { Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { ConversationStarterService } from './conversation-starter.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SafetyService } from '../safety/safety.service';

interface QueryChain {
  select: Mock;
  eq: Mock;
  in: Mock;
  limit: Mock;
  single: Mock;
}

function resolvedChain(result: { data: unknown; error: unknown }): QueryChain {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  } as QueryChain;
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.limit.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  return chain;
}

describe('ConversationStarterService', () => {
  let from: Mock;
  let llmProxy: { proxyMessage: Mock };
  let safetyService: { getBlockedAndBlockerIds: Mock };
  let configService: { get: Mock };
  let service: ConversationStarterService;

  const currentUserId = 'current-user';
  const partnerId = 'partner-user';

  beforeEach(() => {
    from = vi.fn();
    llmProxy = { proxyMessage: vi.fn() };
    safetyService = { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) };
    configService = { get: vi.fn().mockReturnValue(undefined) };

    service = new ConversationStarterService(
      configService as unknown as ConfigService,
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      llmProxy as unknown as LlmProxyService,
      safetyService as unknown as SafetyService,
    );
  });

  function queueEligibleDirectRoom(): void {
    const membershipQueries = [
      resolvedChain({ data: [{ room_id: 'direct-room' }], error: null }),
      resolvedChain({ data: [{ room_id: 'direct-room' }], error: null }),
      resolvedChain({
        data: [
          { room_id: 'direct-room', user_id: currentUserId },
          { room_id: 'direct-room', user_id: partnerId },
        ],
        error: null,
      }),
    ];

    from.mockImplementation((table: string) => {
      if (table === 'chat_room_members') {
        const next = membershipQueries.shift();
        if (!next) throw new Error('Unexpected chat_room_members query');
        return next;
      }
      if (table === 'users') {
        return resolvedChain({
          data: {
            display_name: 'Mika',
            bio_text: 'I like hiking and coffee.',
            native_language: 'ja',
            target_languages: ['en'],
          },
          error: null,
        });
      }
      if (table === 'user_interests') {
        return resolvedChain({
          data: [{ interest: { name: 'Hiking' } }],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
  }

  it('returns three generated suggestions for an eligible direct-chat partner', async () => {
    queueEligibleDirectRoom();
    llmProxy.proxyMessage.mockResolvedValue({
      response: 'What trail do you recommend?\nWhat coffee do you like?\nHow are you practising English?',
    });

    const result = await service.getSuggestions(currentUserId, partnerId);

    expect(result).toEqual([
      'What trail do you recommend?',
      'What coffee do you like?',
      'How are you practising English?',
    ]);
    expect(llmProxy.proxyMessage).toHaveBeenCalledTimes(1);
    const prompt = llmProxy.proxyMessage.mock.calls[0][0] as string;
    expect(prompt).toContain('untrusted user content');
    expect(prompt).toContain('PROFILE_JSON');
  });

  it('caches generated suggestions so repeated opens do not consume LLM quota', async () => {
    queueEligibleDirectRoom();
    llmProxy.proxyMessage.mockResolvedValue({
      response: 'Question one?\nQuestion two?\nQuestion three?',
    });

    const first = await service.getSuggestions(currentUserId, partnerId);

    // Eligibility and blocking are intentionally re-checked on every request even
    // when the generated copy itself is cached.
    queueEligibleDirectRoom();
    const second = await service.getSuggestions(currentUserId, partnerId);

    expect(second).toEqual(first);
    expect(llmProxy.proxyMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects blocked partners before reading profile data or calling the LLM', async () => {
    queueEligibleDirectRoom();
    safetyService.getBlockedAndBlockerIds.mockResolvedValue([partnerId]);

    await expect(
      service.getSuggestions(currentUserId, partnerId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(llmProxy.proxyMessage).not.toHaveBeenCalled();
  });

  it('rejects a shared group member that is not also a direct-chat partner', async () => {
    const membershipQueries = [
      resolvedChain({ data: [{ room_id: 'group-room' }], error: null }),
      resolvedChain({ data: [{ room_id: 'group-room' }], error: null }),
      resolvedChain({
        data: [
          { room_id: 'group-room', user_id: currentUserId },
          { room_id: 'group-room', user_id: partnerId },
          { room_id: 'group-room', user_id: 'third-user' },
        ],
        error: null,
      }),
    ];
    from.mockImplementation((table: string) => {
      if (table !== 'chat_room_members') throw new Error('Unexpected profile query');
      const next = membershipQueries.shift();
      if (!next) throw new Error('Unexpected membership query');
      return next;
    });

    await expect(
      service.getSuggestions(currentUserId, partnerId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(llmProxy.proxyMessage).not.toHaveBeenCalled();
  });

  it('fills empty or partial model output with deterministic fallback questions', async () => {
    queueEligibleDirectRoom();
    llmProxy.proxyMessage.mockResolvedValue({ response: '' });

    const result = await service.getSuggestions(currentUserId, partnerId);

    expect(result).toHaveLength(3);
    expect(result.every((suggestion) => suggestion.length > 0)).toBe(true);
    expect(result[0]).toContain('Hiking');
  });

  it('enforces a conversation-starter-specific request limit', async () => {
    configService.get.mockImplementation((key: string) =>
      key === 'CONVERSATION_STARTER_RATE_LIMIT_PER_MINUTE' ? '1' : undefined,
    );
    queueEligibleDirectRoom();
    llmProxy.proxyMessage.mockResolvedValue({
      response: 'One?\nTwo?\nThree?',
    });
    await service.getSuggestions(currentUserId, partnerId);

    await expect(service.getSuggestions(currentUserId, partnerId)).rejects.toMatchObject({
      status: 429,
    });
  });
});
