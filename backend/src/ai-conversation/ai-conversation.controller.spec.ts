import { AiConversationController } from './ai-conversation.controller';
import { AiConversationService } from './ai-conversation.service';

describe('AiConversationController', () => {
  let controller: AiConversationController;
  let service: { getScenarios: jest.Mock; generateReply: jest.Mock };

  beforeEach(() => {
    service = {
      getScenarios: jest.fn(),
      generateReply: jest.fn(),
    };
    controller = new AiConversationController(
      service as unknown as AiConversationService,
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
    it('should return a hint when message is empty', async () => {
      const result = await controller.handleMessage({ message: '' });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(service.generateReply).not.toHaveBeenCalled();
    });

    it('should return a hint when message is only whitespace', async () => {
      const result = await controller.handleMessage({ message: '   ' });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(service.generateReply).not.toHaveBeenCalled();
    });

    it('should call generateReply with message, scenarioId, and conversationHistory', async () => {
      const reply = 'Would you like a latte or cappuccino?';
      service.generateReply.mockResolvedValue(reply);
      const history = [{ role: 'user' as const, content: 'Hello' }];

      const result = await controller.handleMessage({
        message: 'I would like a coffee please.',
        scenarioId: 'ordering-coffee',
        conversationHistory: history,
      });

      expect(service.generateReply).toHaveBeenCalledWith(
        'I would like a coffee please.',
        'ordering-coffee',
        history,
      );
      expect(result).toEqual({ reply });
    });

    it('should call generateReply with message and undefined scenarioId and undefined history', async () => {
      const reply = 'Cultural tip.';
      service.generateReply.mockResolvedValue(reply);

      const result = await controller.handleMessage({ message: 'help' });

      expect(service.generateReply).toHaveBeenCalledWith('help', undefined, undefined);
      expect(result).toEqual({ reply });
    });
  });
});
