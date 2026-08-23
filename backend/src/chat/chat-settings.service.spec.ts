import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatSettingsService } from './chat-settings.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatSettingsService', () => {
  let service: ChatSettingsService;
  let supabaseServiceMock: { getClient: Mock };
  let mockFrom: Mock;
  const userId = 'test-user-id';

  beforeEach(async () => {
    supabaseServiceMock = {
      getClient: vi.fn(),
    };
    mockFrom = vi.fn();
    supabaseServiceMock.getClient.mockReturnValue({ from: mockFrom });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatSettingsService,
        { provide: SupabaseService, useValue: supabaseServiceMock },
      ],
    }).compile();

    service = moduleRef.get<ChatSettingsService>(ChatSettingsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return default settings when no preferences exist', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { chat_preferences: null }, error: null }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(service.getSettings(userId)).resolves.toEqual({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
        disappearingMessagesTtl: 'off',
      });
    });

    it('should fail closed when persisted settings cannot be read', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error('DB error') }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(service.getSettings(userId)).rejects.toThrow(
        'Chat settings are temporarily unavailable',
      );
    });

    it('should return merged settings from stored preferences', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              enterToSend: true,
              disappearingMessagesTtl: '7d',
            },
          },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(service.getSettings(userId)).resolves.toEqual({
        autoTranslate: true,
        readReceipts: false,
        enterToSend: true,
        disappearingMessagesTtl: '7d',
      });
    });

    it('should fail closed to off for an invalid stored retention value', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              disappearingMessagesTtl: '1m',
            },
          },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(service.getSettings(userId)).resolves.toMatchObject({
        disappearingMessagesTtl: 'off',
      });
    });
  });

  describe('updateSettings', () => {
    it('should merge with current settings and update the database', async () => {
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              readReceipts: false,
              enterToSend: false,
              disappearingMessagesTtl: '24h',
            },
          },
          error: null,
        }),
      };
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValueOnce(getChain).mockReturnValueOnce(updateChain);

      const result = await service.updateSettings(userId, {
        readReceipts: true,
        disappearingMessagesTtl: '90d',
      });

      expect(result).toEqual({
        autoTranslate: true,
        readReceipts: true,
        enterToSend: false,
        disappearingMessagesTtl: '90d',
      });
      expect(updateChain.update).toHaveBeenCalledWith({
        chat_preferences: result,
      });
      expect(updateChain.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should return a sanitized failure if the database update fails', async () => {
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: false,
              readReceipts: false,
              enterToSend: false,
              disappearingMessagesTtl: 'off',
            },
          },
          error: null,
        }),
      };
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: new Error('sensitive DB write error') }),
      };
      mockFrom.mockReturnValueOnce(getChain).mockReturnValueOnce(updateChain);

      await expect(
        service.updateSettings(userId, { autoTranslate: true }),
      ).rejects.toThrow('Chat settings could not be updated');
    });

    it('should allow partial updates and preserve other settings', async () => {
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              readReceipts: true,
              enterToSend: true,
              disappearingMessagesTtl: '7d',
            },
          },
          error: null,
        }),
      };
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValueOnce(getChain).mockReturnValueOnce(updateChain);

      const result = await service.updateSettings(userId, {
        autoTranslate: false,
      });

      expect(result.autoTranslate).toBe(false);
      expect(result.readReceipts).toBe(true);
      expect(result.enterToSend).toBe(true);
      expect(result.disappearingMessagesTtl).toBe('7d');
    });
  });
});
