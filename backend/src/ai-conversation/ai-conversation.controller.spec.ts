import { BadRequestException } from '@nestjs/common';
import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';
import { UsersService } from '../users/users.service';

function makeMockUser(id: string) {
  return {
    id,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
}

describe('AiConversationController', () => {
  let controller: AiConversationController;
  let aiService: { getScenarios: jest.Mock; generateReply: jest.Mock };
  let usersService: { getProfile: jest.Mock };

  beforeEach(() => {
    aiService = {
      getScenarios: jest.fn(),
      generateReply: jest.fn(),
    };
    usersService = {
      getProfile: jest.fn(),
    };
    controller = new AiConversationController(
      aiService as unknown as AiConversationService,
      usersService as unknown as UsersService,
    );
  });

  describe('getScenarios', () => {
    it('should call service.getScenarios and return its result', () => {
      const scenarios = [{ id: 'coffee', name: 'Ordering Coffee', icon: '☕' }];
      aiService.getScenarios.mockReturnValue(scenarios);

      const result = controller.getScenarios();

      expect(aiService.getScenarios).toHaveBeenCalled();
      expect(result).toEqual(scenarios);
    });
  });

  describe('handleMessage', () => {
    it('should return auth hint when user is null', async () => {
      const result = await controller.handleMessage(null, { message: 'Hello' });
      expect(result).toEqual({ reply: 'Authentication required.' });
    });

    it('should return a hint when message is empty', async () => {
      const user = makeMockUser('u1');
      const result = await controller.handleMessage(user, { message: '' });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(aiService.generateReply).not.toHaveBeenCalled();
    });

    it('should return a hint when message is only whitespace', async () => {
      const user = makeMockUser('u1');
      const result = await controller.handleMessage(user, { message: '   ' });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(aiService.generateReply).not.toHaveBeenCalled();
    });

    it('should throw when user is not VIP', async () => {
      const user = makeMockUser('u1');
      usersService.getProfile.mockResolvedValue({ id: 'u1', is_vip: false });

      await expect(
        controller.handleMessage(user, { message: 'Hello' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call generateReply when user is VIP', async () => {
      const user = makeMockUser('u1');
      usersService.getProfile.mockResolvedValue({ id: 'u1', is_vip: true });
      const reply = 'Would you like a latte or cappuccino?';
      aiService.generateReply.mockResolvedValue(reply);
      const history = [{ role: 'user' as const, content: 'Hello' }];

      const result = await controller.handleMessage(user, {
        message: 'I would like a coffee please.',
        scenarioId: 'ordering-coffee',
        conversationHistory: history,
      });

      expect(aiService.generateReply).toHaveBeenCalledWith(
        'I would like a coffee please.',
        'ordering-coffee',
        history,
      );
      expect(result).toEqual({ reply });
    });
  });
});
