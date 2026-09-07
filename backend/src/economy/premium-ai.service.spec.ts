import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PremiumAiService } from './premium-ai.service';

function createClient(options?: {
  member?: boolean;
  messages?: Array<Record<string, unknown>>;
  start?: Record<string, unknown>;
  startError?: { message: string; code?: string } | null;
  complete?: boolean;
  completeError?: { message: string; code?: string } | null;
  fail?: boolean;
  failError?: { message: string; code?: string } | null;
}) {
  const membership =
    options?.member === false
      ? null
      : { room_id: '11111111-1111-4111-8111-111111111111' };
  const messages = options?.messages ?? [
    {
      sender_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      message_type: 'text',
      text_content: 'I went to the shop yesterday.',
      created_at: '2026-08-22T10:00:00Z',
    },
    {
      sender_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      message_type: 'text',
      text_content: 'Nice. What did you buy?',
      created_at: '2026-08-22T10:01:00Z',
    },
  ];

  const rpc = vi.fn(async (name: string) => {
    if (name === 'start_premium_ai_service') {
      return {
        data: [
          options?.start ?? {
            run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            run_status: 'pending',
            run_cost_coins: 30,
            coins_remaining: 70,
            run_result: null,
            created: true,
          },
        ],
        error: options?.startError ?? null,
      };
    }
    if (name === 'complete_premium_ai_service') {
      return {
        data: options?.complete ?? true,
        error: options?.completeError ?? null,
      };
    }
    if (name === 'fail_premium_ai_service') {
      return {
        data: options?.fail ?? true,
        error: options?.failError ?? null,
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'chat_room_members') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: membership,
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'chat_messages') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: messages, error: null })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc,
  };

  return { client, rpc };
}

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dto = {
  room_id: '11111111-1111-4111-8111-111111111111',
  idempotency_key: '22222222-2222-4222-8222-222222222222',
};

describe('PremiumAiService', () => {
  it('publishes a server-priced catalog', () => {
    const { client } = createClient();
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn() } as never,
    );

    expect(service.getCatalog()).toEqual([
      expect.objectContaining({
        key: 'conversation_analysis_report',
        cost_coins: 30,
      }),
    ]);
  });

  it('checks room membership before reading messages or charging', async () => {
    const { client, rpc } = createClient({ member: false });
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn() } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalledWith('chat_messages');
  });

  it('does not charge conversations without enough text', async () => {
    const { client, rpc } = createClient({
      messages: [
        {
          sender_id: userId,
          message_type: 'text',
          text_content: 'Only one message',
          created_at: '2026-08-22T10:00:00Z',
        },
      ],
    });
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn() } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('charges exactly once, persists the report and returns the balance', async () => {
    const { client, rpc } = createClient();
    const chatCompletion = vi.fn(
      async () =>
        'Strengths\nClear past tense.\n\nRecurring language issues\nArticles.\n\nUseful vocabulary\nreceipt\n\nNext steps\nPractise articles.',
    );
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion } as never,
    );

    const result = await service.runConversationAnalysis(userId, dto);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'completed',
        cost_coins: 30,
        coins_remaining: 70,
        reused: false,
        message_count: 2,
      }),
    );
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      'start_premium_ai_service',
      expect.objectContaining({
        p_user_id: userId,
        p_subject_id: dto.room_id,
        p_idempotency_key: dto.idempotency_key,
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'complete_premium_ai_service',
      expect.objectContaining({ p_user_id: userId }),
    );
    expect(rpc).not.toHaveBeenCalledWith(
      'fail_premium_ai_service',
      expect.anything(),
    );
  });

  it('reuses a completed request without another provider call', async () => {
    const { client, rpc } = createClient({
      start: {
        run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        run_status: 'completed',
        run_cost_coins: 30,
        coins_remaining: 70,
        run_result: { report: 'Strengths\nGood clarity.', message_count: 5 },
        created: false,
      },
    });
    const chatCompletion = vi.fn();
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion } as never,
    );

    const result = await service.runConversationAnalysis(userId, dto);

    expect(result.reused).toBe(true);
    expect(result.report).toBe('Strengths\nGood clarity.');
    expect(chatCompletion).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('keeps an in-flight idempotent request retryable with the same key', async () => {
    const { client } = createClient({
      start: {
        run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        run_status: 'pending',
        run_cost_coins: 30,
        coins_remaining: 70,
        run_result: null,
        created: false,
      },
    });
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn() } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks a refunded run as non-reusable so clients can create a fresh key', async () => {
    const { client } = createClient({
      start: {
        run_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        run_status: 'failed',
        run_cost_coins: 30,
        coins_remaining: 100,
        run_result: null,
        created: false,
      },
    });
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn() } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('rejects reuse of an idempotency key for another conversation', async () => {
    const { client } = createClient({
      startError: {
        message: 'premium ai idempotency subject mismatch',
        code: 'P0001',
      },
    });
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn() } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('maps insufficient funds without calling the AI provider', async () => {
    const { client } = createClient({
      startError: { message: 'insufficient coins', code: 'P0001' },
    });
    const chatCompletion = vi.fn();
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion } as never,
    );

    await expect(service.runConversationAnalysis(userId, dto)).rejects.toThrow(
      'enough coins',
    );
    expect(chatCompletion).not.toHaveBeenCalled();
  });

  it('refunds the charged run when provider generation fails', async () => {
    const { client, rpc } = createClient();
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn(async () => '') } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(rpc).toHaveBeenCalledWith(
      'fail_premium_ai_service',
      expect.objectContaining({
        p_user_id: userId,
        p_error_code: 'provider_failure',
      }),
    );
  });

  it('never claims a refund when the refund RPC reports no mutation', async () => {
    const { client } = createClient({ fail: false });
    const service = new PremiumAiService(
      { getClient: () => client } as never,
      { chatCompletion: vi.fn(async () => '') } as never,
    );

    await expect(
      service.runConversationAnalysis(userId, dto),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
