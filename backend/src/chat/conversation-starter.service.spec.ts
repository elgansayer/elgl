import { Test, TestingModule } from '@nestjs/testing';
import { ConversationStarterService } from './conversation-starter.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';

describe('ConversationStarterService', () => {
  let service: ConversationStarterService;
  let supabaseService: { getClient: jest.Mock };
  let llmProxyService: { proxyMessage: jest.Mock };
  let mockSupabaseClient: {
    from: jest.Mock;
  };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
    };

    supabaseService = { getClient: jest.fn().mockReturnValue(mockSupabaseClient) };
    llmProxyService = { proxyMessage: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationStarterService,
        { provide: ConfigService, useValue: {} },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: LlmProxyService, useValue: llmProxyService },
      ],
    }).compile();

    service = module.get<ConversationStarterService>(ConversationStarterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSuggestions', () => {
    const partnerId = 'partner-uuid-123';
    const partner = {
      display_name: 'Alice',
      bio_text: 'I love hiking and cooking',
      native_language: 'en',
      target_languages: ['es', 'fr'],
    };

    function setupSupabaseMocks(
      partnerData: Record<string, unknown> | null,
      partnerError: Error | null,
      interestsData: unknown[] | null,
      interestsError: Error | null,
    ) {
      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: partnerData,
          error: partnerError,
        }),
      };

      const interestsChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
      };

      interestsChain.select.mockReturnValue(interestsChain);
      interestsChain.eq.mockResolvedValue({
        data: interestsData,
        error: interestsError,
      });

      (mockSupabaseClient.from as jest.Mock).mockImplementation(
        (table: string) => {
          if (table === 'users') return selectChain;
          if (table === 'user_interests') return interestsChain;
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() };
        },
      );

      return { selectChain, interestsChain };
    }

    it('returns fallback suggestions when partner profile is not found', async () => {
      setupSupabaseMocks(null, new Error('Not found'), [], null);

      const result = await service.getSuggestions('user-1', partnerId);

      expect(result).toEqual([
        'What got you interested in learning this language?',
        'Do you have a favourite word in your target language?',
        'Have you visited any country where your target language is spoken?',
      ]);
    });

    it('returns LLM-generated suggestions when partner profile is available', async () => {
      setupSupabaseMocks(partner, null, [], null);

      llmProxyService.proxyMessage.mockResolvedValue({
        response:
          'What makes you want to learn Spanish?\nDo you prefer coffee or tea?\nWhat do you enjoy cooking?',
      });

      const result = await service.getSuggestions('user-1', partnerId);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('What makes you want to learn Spanish?');
      expect(result[1]).toBe('Do you prefer coffee or tea?');
      expect(llmProxyService.proxyMessage).toHaveBeenCalledTimes(1);
      const prompt = (llmProxyService.proxyMessage as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain('Alice');
      expect(prompt).toContain('hiking');
    });

    it('returns LLM-generated suggestions when partner has no bio', async () => {
      setupSupabaseMocks({ ...partner, bio_text: null }, null, [], null);

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'Hello!\nHow are you?\nTell me about yourself.',
      });

      const result = await service.getSuggestions('user-1', partnerId);
      expect(result).toHaveLength(3);
    });

    it('returns fallback suggestions when LLM call fails', async () => {
      setupSupabaseMocks(partner, null, [], null);

      llmProxyService.proxyMessage.mockRejectedValue(new Error('LLM down'));

      const result = await service.getSuggestions('user-1', partnerId);

      expect(result).toHaveLength(3);
      expect(llmProxyService.proxyMessage).toHaveBeenCalled();
    });

    it('uses default display name when display_name is null', async () => {
      setupSupabaseMocks(
        { ...partner, display_name: null },
        null,
        [],
        null,
      );

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'A\nB\nC',
      });

      const result = await service.getSuggestions('user-1', partnerId);
      expect(result).toHaveLength(3);
      const prompt = (llmProxyService.proxyMessage as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain(partnerId.slice(0, 8));
    });

    it('uses default language when native_language is null', async () => {
      setupSupabaseMocks(
        { ...partner, native_language: null },
        null,
        [],
        null,
      );

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'A\nB\nC',
      });

      const result = await service.getSuggestions('user-1', partnerId);
      expect(result).toHaveLength(3);
      const prompt = (llmProxyService.proxyMessage as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain('English');
    });

    it('includes interests in prompt when available', async () => {
      setupSupabaseMocks(partner, null, [
        { interest: { name: 'Photography' } },
        { interest: { name: 'Travelling' } },
      ], null);

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'A\nB\nC',
      });

      await service.getSuggestions('user-1', partnerId);
      const prompt = (llmProxyService.proxyMessage as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain('Photography');
      expect(prompt).toContain('Travelling');
    });

    it('handles interest rows with null names gracefully', async () => {
      setupSupabaseMocks(partner, null, [
        { interest: { name: null } },
        { interest: null },
        { interest: { name: 'Music' } },
      ], null);

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'A\nB\nC',
      });

      await service.getSuggestions('user-1', partnerId);
      const prompt = (llmProxyService.proxyMessage as jest.Mock).mock.calls[0][0];
      expect(prompt).toContain('Music');
      expect(prompt).not.toContain('null');
    });

    it('trims LLM response to max 3 lines', async () => {
      setupSupabaseMocks(partner, null, [], null);

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'Q1\nQ2\nQ3\nQ4\nQ5',
      });

      const result = await service.getSuggestions('user-1', partnerId);
      expect(result).toHaveLength(3);
    });

    it('filters empty lines from LLM response', async () => {
      setupSupabaseMocks(partner, null, [], null);

      llmProxyService.proxyMessage.mockResolvedValue({
        response: '\n\nQ1\n\nQ2\n\nQ3\n\n',
      });

      const result = await service.getSuggestions('user-1', partnerId);
      expect(result).toEqual(['Q1', 'Q2', 'Q3']);
    });

    it('handles interests error gracefully', async () => {
      setupSupabaseMocks(partner, null, null, new Error('DB error'));

      llmProxyService.proxyMessage.mockResolvedValue({
        response: 'A\nB\nC',
      });

      const result = await service.getSuggestions('user-1', partnerId);
      expect(result).toHaveLength(3);
      const prompt = (llmProxyService.proxyMessage as jest.Mock).mock.calls[0][0];
      expect(prompt).not.toContain('Interests');
    });
  });
});