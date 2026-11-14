import type { Mock } from 'vitest';
import { User } from '@supabase/supabase-js';
import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';
import { DeveloperBotsService } from '../developer-bots/developer-bots.service';

function mockUser(): User {
  return { id: 'user-123' } as unknown as User;
}

describe('AiConversationController', () => {
  let controller: AiConversationController;
  let service: {
    getScenarios: Mock;
    generateReply: Mock;
    checkDailyAiRateLimit: Mock;
  };
  let botsService: { getEnabledBot: Mock };

  beforeEach(() => {
    service = {
      getScenarios: vi.fn(),
      generateReply: vi.fn(),
      checkDailyAiRateLimit: vi.fn().mockResolvedValue(true),
    };
    botsService = { getEnabledBot: vi.fn() };
    controller = new AiConversationController(
      service as unknown as AiConversationService,
      botsService as unknown as DeveloperBotsService,
    );
  });

  describe('getScenarios', () => {
    it('should call service.getScenarios and return its result', () => {
      const scenarios = [{ id: 'coffee', name: 'Ordering Coffee', icon: '☕' }];
      service.getScenarios.mockReturnValue(scenarios);

      const result = controller.getScenarios();

      expect(service.getScenarios).toHaveBeenCalled();
      expect(result).toEqual(scenarios);
    });
  });

  describe('handleMessage', () => {
    it('should throw 401 when user is null', async () => {
      await expect(
        controller.handleMessage(null, { message: 'Hi' }),
      ).rejects.toThrow('Unauthorized');
    });

    it('should return a hint when message is empty', async () => {
      const result = await controller.handleMessage(mockUser(), {
        message: '',
      });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(service.generateReply).not.toHaveBeenCalled();
    });

    it('should return a hint when message is only whitespace', async () => {
      const result = await controller.handleMessage(mockUser(), {
        message: '   ',
      });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(service.generateReply).not.toHaveBeenCalled();
    });

    it('should check daily AI rate limit for the user', async () => {
      service.checkDailyAiRateLimit.mockResolvedValue(true);
      service.generateReply.mockResolvedValue('Hello!');

      await controller.handleMessage(mockUser(), { message: 'Hi' });

      expect(service.checkDailyAiRateLimit).toHaveBeenCalledWith('user-123');
    });

    it('should throw 429 when daily AI rate limit exceeded', async () => {
      service.checkDailyAiRateLimit.mockResolvedValue(false);

      await expect(
        controller.handleMessage(mockUser(), { message: 'Hi' }),
      ).rejects.toThrow('Daily AI usage limit reached');
    });

    it('resolves a custom bot for the caller and passes it to the reply', async () => {
      const bot = {
        id: '11111111-1111-4111-8111-111111111111',
        owner_id: 'user-123',
        display_name: 'Chef Ana',
        persona: 'A cheerful Spanish chef',
        target_language: 'es',
        tone: 'playful',
        greeting: 'Hola',
        is_enabled: true,
        created_at: '2026-11-14T00:00:00.000Z',
        updated_at: '2026-11-14T00:00:00.000Z',
      };
      botsService.getEnabledBot.mockResolvedValue(bot);
      service.generateReply.mockResolvedValue('Buenas');

      await controller.handleMessage(mockUser(), {
        message: 'Hola',
        botId: bot.id,
      });

      expect(botsService.getEnabledBot).toHaveBeenCalledWith(
        bot.id,
        'user-123',
      );
      expect(service.generateReply).toHaveBeenCalledWith(
        'user-123',
        'Hola',
        undefined,
        undefined,
        bot,
      );
    });

    it('does not resolve a bot when no bot id is supplied', async () => {
      service.generateReply.mockResolvedValue('Hello');

      await controller.handleMessage(mockUser(), { message: 'Hi' });

      expect(botsService.getEnabledBot).not.toHaveBeenCalled();
    });

    it('should call generateReply with message, scenarioId, and conversationHistory', async () => {
      const reply = 'Would you like a latte or cappuccino?';
      service.generateReply.mockResolvedValue(reply);
      const history = [{ role: 'user' as const, content: 'Hello' }];

      const result = await controller.handleMessage(mockUser(), {
        message: 'I would like a coffee please.',
        scenarioId: 'ordering-coffee',
        conversationHistory: history,
      });

      expect(service.generateReply).toHaveBeenCalledWith(
        'user-123',
        'I would like a coffee please.',
        'ordering-coffee',
        history,
        undefined,
      );
      expect(result).toEqual({ reply });
    });

    it('should call generateReply with message and undefined scenarioId and undefined history', async () => {
      const reply = 'Cultural tip.';
      service.generateReply.mockResolvedValue(reply);

      const result = await controller.handleMessage(mockUser(), {
        message: 'help',
      });

      expect(service.generateReply).toHaveBeenCalledWith(
        'user-123',
        'help',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual({ reply });
    });
  });
});
