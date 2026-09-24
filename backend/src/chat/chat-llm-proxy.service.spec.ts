import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ChatLlmProxyService } from './chat-llm-proxy.service';
import { ChatLlmService } from './chat-llm.service';

describe('ChatLlmProxyService', () => {
  let service: ChatLlmProxyService;
  let chatLlmService: ChatLlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatLlmProxyService,
        {
          provide: ChatLlmService,
          useValue: {
            proxyChatMessages: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatLlmProxyService>(ChatLlmProxyService);
    chatLlmService = module.get<ChatLlmService>(ChatLlmService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('proxyChatMessage', () => {
    it('should throw BadRequestException when messageText is empty', async () => {
      await expect(service.proxyChatMessage('user-1', '')).rejects.toThrow(
        BadRequestException,
      );
      expect(chatLlmService.proxyChatMessages).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when messageText is whitespace only', async () => {
      await expect(service.proxyChatMessage('user-1', '   ')).rejects.toThrow(
        BadRequestException,
      );
      expect(chatLlmService.proxyChatMessages).not.toHaveBeenCalled();
    });

    it('should build messages with a system prompt and the user message when history is omitted', async () => {
      (chatLlmService.proxyChatMessages as Mock).mockResolvedValue({
        response: 'Hello there!',
      });

      const result = await service.proxyChatMessage('user-1', 'Hi');

      expect(chatLlmService.proxyChatMessages).toHaveBeenCalledWith([
        {
          role: 'system',
          content:
            'You are a helpful conversation partner for language learners. Reply in a friendly, concise manner. Ensure Comprehensible Input by using vocabulary slightly above the user\'s level (i+1).',
        },
        { role: 'user', content: 'Hi' },
      ]);
      expect(result).toEqual({ response: 'Hello there!' });
    });

    it('should include prior history before the new user message', async () => {
      (chatLlmService.proxyChatMessages as Mock).mockResolvedValue({
        response: 'Sure, happy to help.',
      });

      const history: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: 'What is the weather?' },
        { role: 'assistant', content: 'I cannot check the weather.' },
      ];

      const result = await service.proxyChatMessage(
        'user-1',
        'Can you help me?',
        history,
      );

      expect(chatLlmService.proxyChatMessages).toHaveBeenCalledWith([
        {
          role: 'system',
          content:
            'You are a helpful conversation partner for language learners. Reply in a friendly, concise manner. Ensure Comprehensible Input by using vocabulary slightly above the user\'s level (i+1).',
        },
        { role: 'user', content: 'What is the weather?' },
        { role: 'assistant', content: 'I cannot check the weather.' },
        { role: 'user', content: 'Can you help me?' },
      ]);
      expect(result).toEqual({ response: 'Sure, happy to help.' });
    });
  });

  describe('proxyChatWithHistory', () => {
    it('should throw BadRequestException when conversation is undefined', async () => {
      await expect(
        service.proxyChatWithHistory(
          'user-1',
          undefined as unknown as {
            role: 'user' | 'assistant';
            content: string;
          }[],
        ),
      ).rejects.toThrow(BadRequestException);
      expect(chatLlmService.proxyChatMessages).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when conversation is empty', async () => {
      await expect(service.proxyChatWithHistory('user-1', [])).rejects.toThrow(
        BadRequestException,
      );
      expect(chatLlmService.proxyChatMessages).not.toHaveBeenCalled();
    });

    it('should prepend a system prompt to the conversation', async () => {
      (chatLlmService.proxyChatMessages as Mock).mockResolvedValue({
        response: 'Got it.',
      });

      const conversation: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi, how can I help?' },
      ];

      const result = await service.proxyChatWithHistory('user-1', conversation);

      expect(chatLlmService.proxyChatMessages).toHaveBeenCalledWith([
        {
          role: 'system',
          content:
            'You are a helpful conversation partner for language learners. Reply in a friendly, concise manner. Ensure Comprehensible Input by using vocabulary slightly above the user\'s level (i+1).',
        },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi, how can I help?' },
      ]);
      expect(result).toEqual({ response: 'Got it.' });
    });
  });
});
