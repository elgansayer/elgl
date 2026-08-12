import { AiConversationService } from './ai-conversation.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('AiConversationService', () => {
  let service: AiConversationService;
  let llmProxy: { chatCompletion: jest.Mock };
  let supabaseService: {
    isVipUser: jest.Mock;
    getRedisClient: jest.Mock;
  };
  let redisMock: {
    incr: jest.Mock;
    expire: jest.Mock;
  };

  beforeEach(() => {
    redisMock = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue('OK'),
    };

    llmProxy = { chatCompletion: jest.fn() };
    supabaseService = {
      isVipUser: jest.fn().mockResolvedValue(false),
      getRedisClient: jest.fn().mockReturnValue(redisMock),
    };

    service = new AiConversationService(
      llmProxy as unknown as LlmProxyService,
      supabaseService as unknown as SupabaseService,
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
    it('should call llmProxy.chatCompletion with system prompt from scenario', async () => {
      llmProxy.chatCompletion.mockResolvedValue(
        'Would you like a latte or cappuccino?',
      );

      const reply = await service.generateReply('Hi', 'ordering-coffee');

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

      await service.generateReply('I am doing well', 'small-talk', history);

      const messages = llmProxy.chatCompletion.mock.calls[0][0];
      expect(messages).toHaveLength(4); // system + 2 history + 1 user
      expect(messages[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should use default system prompt when no scenarioId provided', async () => {
      llmProxy.chatCompletion.mockResolvedValue('Interesting!');

      await service.generateReply('Tell me about yourself');

      const messages = llmProxy.chatCompletion.mock.calls[0][0];
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('AI language partner');
    });

    it('should fallback to local replies when LLM fails', async () => {
      llmProxy.chatCompletion.mockRejectedValue(new Error('API down'));

      const reply = await service.generateReply('Hi there!', 'ordering-coffee');

      expect(reply).toBeTruthy();
      expect(typeof reply).toBe('string');
    });

    it('should fallback to local replies when LLM returns empty string', async () => {
      llmProxy.chatCompletion.mockResolvedValue('');

      const reply = await service.generateReply('Hello', 'job-interview');

      expect(reply).toBeTruthy();
      expect(typeof reply).toBe('string');
    });
  });
});
