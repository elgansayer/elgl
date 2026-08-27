import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SafetyService } from '../safety/safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ConversationStarterService } from './conversation-starter.service';

interface QueryResponse {
  data?: unknown;
  error?: { message: string } | null;
}

function makeQuery(response: QueryResponse) {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'is', 'limit']) {
    query[method] = vi.fn(() => query);
  }
  query['maybeSingle'] = vi.fn(() => Promise.resolve(response));
  query['then'] = (
    resolve: (value: QueryResponse) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(response).then(resolve, reject);
  return query;
}

const userId = '11111111-1111-4111-8111-111111111111';
const partnerId = '22222222-2222-4222-8222-222222222222';
const roomId = '33333333-3333-4333-8333-333333333333';

function eligibleResponses(
  profile: QueryResponse = {
    data: {
      display_name: 'Mika',
      bio_text: 'I like hiking and cooking.',
      native_language: 'ja',
      target_languages: ['en'],
      profile_visibility: 'everyone',
      is_deletion_pending: false,
    },
    error: null,
  },
): QueryResponse[] {
  return [
    { data: [{ room_id: roomId }], error: null },
    { data: [{ room_id: roomId }], error: null },
    { data: [{ id: roomId }], error: null },
    {
      data: [
        { room_id: roomId, user_id: userId },
        { room_id: roomId, user_id: partnerId },
      ],
      error: null,
    },
    profile,
  ];
}

describe('ConversationStarterService', () => {
  let from: ReturnType<typeof vi.fn>;
  let llm: { proxyMessage: ReturnType<typeof vi.fn> };
  let safety: { getBlockedAndBlockerIds: ReturnType<typeof vi.fn> };
  let service: ConversationStarterService;

  beforeEach(() => {
    from = vi.fn();
    llm = { proxyMessage: vi.fn() };
    safety = { getBlockedAndBlockerIds: vi.fn().mockResolvedValue([]) };
    service = new ConversationStarterService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      llm as unknown as LlmProxyService,
      safety as unknown as SafetyService,
    );
  });

  it('rejects blocked partners before reading profile data', async () => {
    safety.getBlockedAndBlockerIds.mockResolvedValue([partnerId]);

    await expect(service.getSuggestions(userId, partnerId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(from).not.toHaveBeenCalled();
    expect(llm.proxyMessage).not.toHaveBeenCalled();
  });

  it('rejects arbitrary profile probing without a two-member direct room', async () => {
    from.mockReturnValueOnce(makeQuery({ data: [], error: null }));

    await expect(service.getSuggestions(userId, partnerId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(llm.proxyMessage).not.toHaveBeenCalled();
  });

  it('rejects hidden partner profiles even when a direct room exists', async () => {
    const responses = eligibleResponses({
      data: {
        display_name: 'Hidden',
        profile_visibility: 'hidden',
        is_deletion_pending: false,
      },
      error: null,
    });
    from.mockImplementation(() => makeQuery(responses.shift() ?? {}));

    await expect(service.getSuggestions(userId, partnerId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(llm.proxyMessage).not.toHaveBeenCalled();
  });

  it('returns three bounded suggestions and strips model list prefixes', async () => {
    const responses = [
      ...eligibleResponses(),
      { data: [{ interests: { name: 'Hiking' } }], error: null },
    ];
    from.mockImplementation(() => makeQuery(responses.shift() ?? {}));
    llm.proxyMessage.mockResolvedValue(
      '1. What trail would you recommend?\n- What food do you enjoy cooking?\n* What are you learning this week?',
    );

    const suggestions = await service.getSuggestions(userId, partnerId);

    expect(suggestions).toEqual([
      'What trail would you recommend?',
      'What food do you enjoy cooking?',
      'What are you learning this week?',
    ]);
    expect(suggestions.every((suggestion) => suggestion.length <= 160)).toBe(true);
  });

  it('uses deterministic fallbacks when the LLM provider is unavailable', async () => {
    const responses = [
      ...eligibleResponses(),
      { data: [{ interests: { name: 'Hiking' } }], error: null },
    ];
    from.mockImplementation(() => makeQuery(responses.shift() ?? {}));
    llm.proxyMessage.mockRejectedValue(new Error('provider unavailable'));

    const suggestions = await service.getSuggestions(userId, partnerId);

    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toContain('Hiking');
    expect(suggestions.join(' ')).not.toContain('provider unavailable');
  });

  it('reuses cached suggestions without spending another LLM request', async () => {
    const responses = [
      ...eligibleResponses(),
      { data: [], error: null },
      ...eligibleResponses(),
    ];
    from.mockImplementation(() => makeQuery(responses.shift() ?? {}));
    llm.proxyMessage.mockResolvedValue(
      'What are you studying?\nWhat made you smile today?\nWhat place would you recommend?',
    );

    const first = await service.getSuggestions(userId, partnerId);
    const second = await service.getSuggestions(userId, partnerId);

    expect(second).toEqual(first);
    expect(llm.proxyMessage).toHaveBeenCalledTimes(1);
  });
});
