import type { Mock } from 'vitest';
import { AiConversationService } from './ai-conversation.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { StudyStreakService } from '../study-streak/study-streak.service';
import { LearnerKnowledgeService } from '../learner-knowledge/learner-knowledge.service';

describe('AiConversationService', () => {
  let service: AiConversationService;
  let llmProxy: { chatCompletion: Mock };
  let supabaseService: {
    isVipUser: Mock;
    getRedisClient: Mock;
  };
  let usersService: { getProfile: vi.Mock };
  let flashcardsService: { getFlashcards: vi.Mock };
  let studyStreakService: { getStreak: vi.Mock };
  let learnerKnowledgeService: { getProfile: vi.Mock };
  let redisMock: {
    incr: Mock;
    expire: Mock;
  };

  beforeEach(() => {
    redisMock = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue('OK'),
    };

    llmProxy = { chatCompletion: vi.fn() };
    supabaseService = {
      isVipUser: vi.fn().mockResolvedValue(false),
      getRedisClient: vi.fn().mockReturnValue(redisMock),
    };
    usersService = {
      getProfile: vi.fn().mockResolvedValue({
        target_languages: ['Spanish'],
        interests: ['travel'],
        proficiency_level: 'intermediate',
      }),
    };
    flashcardsService = {
      getFlashcards: vi.fn().mockResolvedValue([{ word_token: 'hola' }]),
    };
    studyStreakService = {
      getStreak: vi.fn().mockResolvedValue(5),
    };

    learnerKnowledgeService = {
      getProfile: vi.fn().mockResolvedValue({
        globalProficiency: { level: 'B2' },
        globalKnowledgeItems: new Map([
          ['vocab:gato', { id: 'vocab:gato', status: 'struggling' }],
        ]),
      }),
    };

    service = new AiConversationService(
      llmProxy as unknown as LlmProxyService,
      supabaseService as unknown as SupabaseService,
      usersService as unknown as UsersService,
      flashcardsService as unknown as FlashcardsService,
      studyStreakService as unknown as StudyStreakService,
      learnerKnowledgeService as unknown as LearnerKnowledgeService,
    );
  });

  describe('getScenarios', () => {
    it('should return scenarios without systemPrompt', () => {
      const result = service.getScenarios();
      expect(result).toHaveLength(10);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('icon');
      expect(result[0]).not.toHaveProperty('systemPrompt');
    });

    it('should return ordering-coffee as the first scenario', () => {
      const result = service.getScenarios();
      expect(result[0].id).toBe('ordering-coffee');
      expect(result[0].name).toBe('Ordering Coffee');
    });

    it('should have unique scenario IDs', () => {
      const result = service.getScenarios();
      const ids = result.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('checkDailyAiRateLimit', () => {
    it('should return true for VIP users without querying Redis', async () => {
      supabaseService.isVipUser.mockResolvedValue(true);

      const result = await service.checkDailyAiRateLimit('vip-user');

      expect(result).toBe(true);
      expect(redisMock.incr).not.toHaveBeenCalled();
    });

    it('should return true when Redis key count is under the limit', async () => {
      redisMock.incr.mockResolvedValue(5);

      const result = await service.checkDailyAiRateLimit('free-user');

      expect(result).toBe(true);
      expect(redisMock.incr).toHaveBeenCalled();
    });

    it('should return false when Redis key count exceeds the limit', async () => {
      redisMock.incr.mockResolvedValue(11);

      const result = await service.checkDailyAiRateLimit('free-user');

      expect(result).toBe(false);
    });

    it('should set expiry when key is created (count === 1)', async () => {
      redisMock.incr.mockResolvedValue(1);

      await service.checkDailyAiRateLimit('free-user');

      expect(redisMock.expire).toHaveBeenCalledWith(
        expect.stringMatching(/^daily_ai_usage:free-user:\d{4}-\d{2}-\d{2}$/),
        86400,
      );
    });

    it('should not set expiry when key already exists (count > 1)', async () => {
      redisMock.incr.mockResolvedValue(3);

      await service.checkDailyAiRateLimit('free-user');

      expect(redisMock.expire).not.toHaveBeenCalled();
    });

    it('should return true and log warning when Redis client is null', async () => {
      supabaseService.getRedisClient.mockReturnValue(null);

      const result = await service.checkDailyAiRateLimit('free-user');

      expect(result).toBe(true);
    });

    it('should return true on Redis error', async () => {
      redisMock.incr.mockRejectedValue(new Error('connection lost'));

      const result = await service.checkDailyAiRateLimit('free-user');

      expect(result).toBe(true);
    });

    it('should use unique keys per user and date', async () => {
      redisMock.incr.mockResolvedValue(1);

      await service.checkDailyAiRateLimit('user-a');
      await service.checkDailyAiRateLimit('user-b');

      const calls = redisMock.incr.mock.calls;
      const keyA: string = calls[0][0];
      const keyB: string = calls[1][0];

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain('user-a');
      expect(keyB).toContain('user-b');

      // Both keys should include today's date
      const today = new Date().toISOString().slice(0, 10);
      expect(keyA).toContain(today);
      expect(keyB).toContain(today);
    });
  });

  describe('generateReply', () => {
    it('should generate a reply without English-only vocabulary for Spanish prompts', async () => {
      // Set target language to 'es'
      usersService.getProfile.mockResolvedValue({
        target_languages: ['es'],
        proficiency_level: 'A2',
        interests: ['culture'],
      });

      // Provide both global and language items
      learnerKnowledgeService.getProfile.mockResolvedValue({
        globalProficiency: { level: 'A2' },
        globalKnowledgeItems: new Map([
          [
            'vocab:globalWord',
            { id: 'vocab:globalWord', status: 'struggling' },
          ],
        ]),
        languageKnowledgeItems: new Map([
          ['vocab:hola', { id: 'vocab:hallo', status: 'struggling' }],
        ]),
      });

      llmProxy.chatCompletion.mockResolvedValue('Hola! ¿Cómo estás?');

      const reply = await service.generateReply('user1', 'Hola', undefined);

      expect(reply).toBe('Hola! ¿Cómo estás?');
      expect(usersService.getProfile).toHaveBeenCalledWith('user1');
      expect(learnerKnowledgeService.getProfile).toHaveBeenCalledWith(
        'user1',
        'es',
      );

      const llmMessages = llmProxy.chatCompletion.mock.calls[0][0];
      const systemPrompt = llmMessages.find(
        (m: any) => m.role === 'system',
      ).content;

      // Should contain the Spanish struggling word 'hallo' and the global one 'globalWord'
      // It should NOT fetch 'en' explicitly
      expect(systemPrompt).toContain('globalWord');
      expect(systemPrompt).toContain('hallo');
    });

    it('should call llmProxy.chatCompletion with system prompt from scenario', async () => {
      llmProxy.chatCompletion.mockResolvedValue(
        'Would you like a latte or cappuccino?',
      );

      const reply = await service.generateReply(
        'user-123',
        'Hi',
        'ordering-coffee',
      );

      expect(llmProxy.chatCompletion).toHaveBeenCalledTimes(1);
      const messages = llmProxy.chatCompletion.mock.calls[0][0];
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('barista');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('Hi');
      expect(reply).toBe('Would you like a latte or cappuccino?');
    });

    it('should include conversation history in messages', async () => {
      llmProxy.chatCompletion.mockResolvedValue('Great, thanks for sharing.');

      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      await service.generateReply(
        'user-123',
        'I am doing well',
        'small-talk',
        history,
      );

      const messages = llmProxy.chatCompletion.mock.calls[0][0];
      expect(messages).toHaveLength(4); // system + 2 history + 1 user
      expect(messages[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should use default system prompt when no scenarioId provided', async () => {
      learnerKnowledgeService.getProfile.mockResolvedValue({
        globalProficiency: { level: 'A2' },
        globalKnowledgeItems: new Map(),
        languageKnowledgeItems: new Map(),
      });
      llmProxy.chatCompletion.mockResolvedValue('Interesting!');

      await service.generateReply('user-123', 'Tell me about yourself');

      const messages = llmProxy.chatCompletion.mock.calls[0][0];
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain(
        'You are a personalized, expert language tutor',
      );
    });

    it('should fallback to local replies when LLM fails', async () => {
      llmProxy.chatCompletion.mockRejectedValue(new Error('API down'));

      const reply = await service.generateReply(
        'user-123',
        'Hi there!',
        'ordering-coffee',
      );

      expect(reply).toBeTruthy();
      expect(typeof reply).toBe('string');
    });

    it('should fallback to local replies when LLM returns empty string', async () => {
      llmProxy.chatCompletion.mockResolvedValue('');

      const reply = await service.generateReply(
        'user-123',
        'Hello',
        'job-interview',
      );

      expect(reply).toBeTruthy();
      expect(typeof reply).toBe('string');
    });
  });
});
