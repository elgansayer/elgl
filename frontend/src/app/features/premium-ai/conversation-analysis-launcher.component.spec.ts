import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmService } from '../../services/confirm.service';
import { EconomyStore } from '../../services/economy.store';
import { PremiumAiService } from '../../services/premium-ai.service';
import { ConversationAnalysisLauncherComponent } from './conversation-analysis-launcher.component';

const roomId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const nextRequestId = '33333333-3333-4333-8333-333333333333';
const catalog = [
  {
    key: 'conversation_analysis_report' as const,
    name: 'Conversation Analysis Report',
    description: 'Learner-focused feedback.',
    cost_coins: 30,
  },
];

function completedResult(id = '44444444-4444-4444-8444-444444444444') {
  return {
    run_id: id,
    service_key: 'conversation_analysis_report' as const,
    cost_coins: 30,
    coins_remaining: 70,
    status: 'completed' as const,
    report: 'Strengths\nClear communication.',
    message_count: 10,
    reused: false,
  };
}

describe('ConversationAnalysisLauncherComponent', () => {
  let events: Subject<NavigationEnd>;
  let premiumAi: {
    getServices: ReturnType<typeof vi.fn>;
    createIdempotencyKey: ReturnType<typeof vi.fn>;
    runConversationAnalysis: ReturnType<typeof vi.fn>;
  };
  let confirm: ReturnType<typeof vi.fn>;
  const coinsBalance = signal(100);

  beforeEach(() => {
    events = new Subject<NavigationEnd>();
    premiumAi = {
      getServices: vi.fn().mockResolvedValue(catalog),
      createIdempotencyKey: vi.fn().mockReturnValue(requestId),
      runConversationAnalysis: vi.fn().mockResolvedValue(completedResult()),
    };
    confirm = vi.fn().mockResolvedValue(true);
    coinsBalance.set(100);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: { url: '/home', events } as unknown as Router,
        },
        {
          provide: PremiumAiService,
          useValue: premiumAi,
        },
        {
          provide: ConfirmService,
          useValue: { confirm },
        },
        {
          provide: EconomyStore,
          useValue: { coinsBalance },
        },
      ],
    });
  });

  function createComponent(): ConversationAnalysisLauncherComponent {
    return TestBed.runInInjectionContext(() => new ConversationAnalysisLauncherComponent());
  }

  it('stays hidden outside chat and loads the server catalog when a room opens', async () => {
    const component = createComponent();
    expect(component.roomId()).toBeNull();
    expect(premiumAi.getServices).not.toHaveBeenCalled();

    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    expect(component.roomId()).toBe(roomId);
    expect(premiumAi.getServices).toHaveBeenCalledTimes(1);
    expect(component.service()?.cost_coins).toBe(30);
  });

  it('confirms the price, runs the purchase and updates the visible balance', async () => {
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('🪙 30'));
    expect(premiumAi.runConversationAnalysis).toHaveBeenCalledWith(roomId, requestId);
    expect(component.result()?.report).toContain('Strengths');
    expect(coinsBalance()).toBe(70);
  });

  it('retains the same idempotency key after an unknown network outcome', async () => {
    premiumAi.runConversationAnalysis
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 0, statusText: 'Network error' }))
      .mockResolvedValueOnce(completedResult());
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();
    await component.runAnalysis();

    expect(premiumAi.createIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(1, roomId, requestId);
    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(2, roomId, requestId);
  });

  it('retains the same idempotency key while the original request is still processing', async () => {
    premiumAi.runConversationAnalysis
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 409, statusText: 'Conflict' }))
      .mockResolvedValueOnce(completedResult());
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();
    await component.runAnalysis();

    expect(premiumAi.createIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(2, roomId, requestId);
  });

  it('retains the same idempotency key when refund reconciliation is ambiguous', async () => {
    premiumAi.runConversationAnalysis
      .mockRejectedValueOnce(
        new HttpErrorResponse({ status: 500, statusText: 'Reconciliation required' }),
      )
      .mockResolvedValueOnce(completedResult());
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();
    await component.runAnalysis();

    expect(premiumAi.createIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(2, roomId, requestId);
  });

  it('uses a new key after a known refunded server failure', async () => {
    premiumAi.createIdempotencyKey
      .mockReturnValueOnce(requestId)
      .mockReturnValueOnce(nextRequestId);
    premiumAi.runConversationAnalysis
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 503, statusText: 'Unavailable' }))
      .mockResolvedValueOnce(completedResult());
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();
    await component.runAnalysis();

    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(1, roomId, requestId);
    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(2, roomId, nextRequestId);
  });

  it('uses a new key after the backend confirms a stale run was refunded', async () => {
    premiumAi.createIdempotencyKey
      .mockReturnValueOnce(requestId)
      .mockReturnValueOnce(nextRequestId);
    premiumAi.runConversationAnalysis
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 410, statusText: 'Gone' }))
      .mockResolvedValueOnce(completedResult());
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();
    await component.runAnalysis();

    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(1, roomId, requestId);
    expect(premiumAi.runConversationAnalysis).toHaveBeenNthCalledWith(2, roomId, nextRequestId);
  });

  it('does not spend coins when confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    const component = createComponent();
    events.next(new NavigationEnd(1, `/chat/${roomId}`, `/chat/${roomId}`));
    await Promise.resolve();

    await component.runAnalysis();

    expect(premiumAi.runConversationAnalysis).not.toHaveBeenCalled();
    expect(coinsBalance()).toBe(100);
  });
});
