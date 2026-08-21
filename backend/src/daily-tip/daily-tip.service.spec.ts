import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DailyTipService } from './daily-tip.service';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { ChatMessageEvent } from '../notifications/events/notification.events';

interface MockQueryResult {
  data: unknown;
  error: { message: string } | null;
}

describe('DailyTipService', () => {
  let service: DailyTipService;
  let llmProxyService: { proxyMessage: Mock };
  let eventEmitter: { emit: Mock };
  let singleResult: MockQueryResult;
  let selectResult: MockQueryResult;
  let mockQueryBuilder: {
    select: Mock;
    eq: Mock;
    single: Mock;
    then: Mock;
  };

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    singleResult = { data: null, error: null };
    selectResult = { data: [], error: null };

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => Promise.resolve(singleResult)),
      then: vi
        .fn()
        .mockImplementation((resolve: (value: MockQueryResult) => void) => {
          resolve(selectResult);
          return Promise.resolve(selectResult);
        }),
    };

    const mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    llmProxyService = {
      proxyMessage: vi
        .fn()
        .mockResolvedValue({ response: 'Practise a little every day.' }),
    };

    eventEmitter = { emit: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyTipService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        { provide: LlmProxyService, useValue: llmProxyService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<DailyTipService>(DailyTipService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTodayTipForUser', () => {
    it('uses the first target language for the prompt and returns the trimmed tip', async () => {
      singleResult = {
        data: { target_languages: ['fr', 'de'], native_language: 'en' },
        error: null,
      };

      const tip = await service.getTodayTipForUser('user-1');

      expect(llmProxyService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining('fr'),
      );
      expect(tip).toBe('Practise a little every day.');
    });

    it('falls back to the native language when no target languages are set', async () => {
      singleResult = {
        data: { target_languages: [], native_language: 'ja' },
        error: null,
      };

      await service.getTodayTipForUser('user-1');

      expect(llmProxyService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining('ja'),
      );
    });

    it('falls back to "en" when the user has no language preferences', async () => {
      singleResult = { data: null, error: null };

      await service.getTodayTipForUser('user-1');

      expect(llmProxyService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining('en'),
      );
    });

    it('returns a default tip when the LLM proxy throws', async () => {
      singleResult = {
        data: { target_languages: ['es'], native_language: 'en' },
        error: null,
      };
      llmProxyService.proxyMessage.mockRejectedValueOnce(
        new Error('LLM unavailable'),
      );

      const tip = await service.getTodayTipForUser('user-1');

      expect(tip).toBe('Keep practising every day!');
    });

    it('returns a default tip when the LLM proxy responds with no response field', async () => {
      singleResult = {
        data: { target_languages: ['es'], native_language: 'en' },
        error: null,
      };
      llmProxyService.proxyMessage.mockResolvedValueOnce({});

      const tip = await service.getTodayTipForUser('user-1');

      expect(tip).toBe('Keep practising every day!');
    });
  });

  describe('generateDailyTips', () => {
    it('logs and exits early when fetching users fails', async () => {
      selectResult = { data: null, error: { message: 'connection refused' } };

      await service.generateDailyTips();

      expect(llmProxyService.proxyMessage).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('emits a chat.message event with a truncated preview for every user', async () => {
      const longTip = 'x'.repeat(200);
      selectResult = {
        data: [
          { id: 'user-1', target_languages: ['es'], native_language: 'en' },
        ],
        error: null,
      };
      llmProxyService.proxyMessage.mockResolvedValueOnce({ response: longTip });

      await service.generateDailyTips();

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      const [eventName, event] = eventEmitter.emit.mock.calls[0] as [
        string,
        ChatMessageEvent,
      ];
      expect(eventName).toBe('chat.message');
      expect(event.receiverId).toBe('user-1');
      expect(event.senderId).toBe('system');
      expect(event.preview).toHaveLength(120);
      expect(event.preview).toBe(longTip.substring(0, 120));
    });

    it('continues generating tips for remaining users when one user fails', async () => {
      selectResult = {
        data: [
          { id: 'user-1', target_languages: ['es'], native_language: 'en' },
          { id: 'user-2', target_languages: ['fr'], native_language: 'en' },
        ],
        error: null,
      };
      llmProxyService.proxyMessage
        .mockRejectedValueOnce(new Error('LLM unavailable'))
        .mockResolvedValueOnce({ response: 'Bonjour tip.' });

      await service.generateDailyTips();

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      const [, event] = eventEmitter.emit.mock.calls[0] as [
        string,
        ChatMessageEvent,
      ];
      expect(event.receiverId).toBe('user-2');
    });

    it('falls back to native language when target_languages is missing for a user', async () => {
      selectResult = {
        data: [
          { id: 'user-1', target_languages: undefined, native_language: 'de' },
        ],
        error: null,
      };

      await service.generateDailyTips();

      expect(llmProxyService.proxyMessage).toHaveBeenCalledWith(
        expect.stringContaining('de'),
      );
    });
  });
});
