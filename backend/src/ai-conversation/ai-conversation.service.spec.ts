import { AiConversationService } from './ai-conversation.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';

describe('AiConversationService', () => {
  let service: AiConversationService;
  let llmProxy: { chatCompletion: jest.Mock };

  beforeEach(() => {
    llmProxy = { chatCompletion: jest.fn() };
    service = new AiConversationService(llmProxy as unknown as LlmProxyService);
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

  describe('generateReply', () => {
    it('should call llmProxy.chatCompletion with system prompt from scenario', async () => {
      llmProxy.chatCompletion.mockResolvedValue('Would you like a latte or cappuccino?');

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
