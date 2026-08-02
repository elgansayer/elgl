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
      const scenarios = ['ordering food', 'asking directions'];
      service.getScenarios.mockReturnValue(scenarios);

      const result = controller.getScenarios();

      expect(service.getScenarios).toHaveBeenCalled();
      expect(result).toEqual(scenarios);
    });
  });

  describe('handleMessage', () => {
    it('should return a hint when message is empty', () => {
      const result = controller.handleMessage({ message: '' });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(service.generateReply).not.toHaveBeenCalled();
    });

    it('should return a hint when message is only whitespace', () => {
      const result = controller.handleMessage({ message: '   ' });

      expect(result).toEqual({ reply: 'Please say something first!' });
      expect(service.generateReply).not.toHaveBeenCalled();
    });

    it('should call generateReply with message and scenarioId and return its reply', () => {
      const reply =
        'In Japan, it is polite to say “itadakimasu” before eating.';
      service.generateReply.mockReturnValue(reply);

      const result = controller.handleMessage({
        message: 'How do I order ramen?',
        scenarioId: 'japan-restaurant',
      });

      expect(service.generateReply).toHaveBeenCalledWith(
        'How do I order ramen?',
        'japan-restaurant',
      );
      expect(result).toEqual({ reply });
    });

    it('should call generateReply with message and undefined scenarioId', () => {
      const reply = 'Cultural tip.';
      service.generateReply.mockReturnValue(reply);

      const result = controller.handleMessage({ message: 'help' });

      expect(service.generateReply).toHaveBeenCalledWith('help', undefined);
      expect(result).toEqual({ reply });
    });
  });
});
