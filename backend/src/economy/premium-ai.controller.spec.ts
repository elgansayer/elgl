import { UnauthorizedException } from '@nestjs/common';
import { PremiumAiController } from './premium-ai.controller';
import { PremiumAiService } from './premium-ai.service';

const user = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
} as never;
const dto = {
  room_id: '11111111-1111-4111-8111-111111111111',
  idempotency_key: '22222222-2222-4222-8222-222222222222',
};

describe('PremiumAiController', () => {
  it('returns the service catalog', () => {
    const getCatalog = vi.fn().mockReturnValue([
      {
        key: 'conversation_analysis_report',
        name: 'Conversation Analysis Report',
        description: 'Learner-focused feedback.',
        cost_coins: 30,
      },
    ]);
    const controller = new PremiumAiController({
      getCatalog,
    } as unknown as PremiumAiService);

    expect(controller.getServices()).toEqual([
      expect.objectContaining({
        key: 'conversation_analysis_report',
        cost_coins: 30,
      }),
    ]);
    expect(getCatalog).toHaveBeenCalledTimes(1);
  });

  it('fails closed when current-user resolution is missing', async () => {
    const runConversationAnalysis = vi.fn();
    const controller = new PremiumAiController({
      runConversationAnalysis,
    } as unknown as PremiumAiService);

    await expect(
      controller.conversationAnalysis(null, dto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(runConversationAnalysis).not.toHaveBeenCalled();
  });

  it('scopes analysis to the authenticated user', async () => {
    const result = {
      run_id: '33333333-3333-4333-8333-333333333333',
      service_key: 'conversation_analysis_report' as const,
      cost_coins: 30,
      coins_remaining: 70,
      status: 'completed' as const,
      report: 'Strengths\nClear communication.',
      message_count: 12,
      reused: false,
    };
    const runConversationAnalysis = vi.fn().mockResolvedValue(result);
    const controller = new PremiumAiController({
      runConversationAnalysis,
    } as unknown as PremiumAiService);

    await expect(controller.conversationAnalysis(user, dto)).resolves.toEqual(
      result,
    );
    expect(runConversationAnalysis).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      dto,
    );
  });
});
