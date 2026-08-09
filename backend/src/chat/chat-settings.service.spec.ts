import { Test, TestingModule } from '@nestjs/testing';
import { ChatSettingsService } from './chat-settings.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatSettingsService', () => {
  let service: ChatSettingsService;
  let supabaseServiceMock: { getClient: jest.Mock };
  let mockFrom: jest.Mock;
  const userId = 'test-user-id';

  beforeEach(async () => {
    supabaseServiceMock = {
      getClient: jest.fn(),
    };
    mockFrom = jest.fn();
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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should return default settings when no preferences exist', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { chat_preferences: null }, error: null }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await service.getSettings(userId);

      expect(result).toEqual({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
      });
    });

    it('should return default settings on error', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await service.getSettings(userId);

      expect(result).toEqual({
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
      });
    });

    it('should return merged settings from stored preferences', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              enterToSend: true,
            },
          },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await service.getSettings(userId);

      expect(result).toEqual({
        autoTranslate: true,
        readReceipts: false,
        enterToSend: true,
      });
    });
  });

  describe('updateSettings', () => {
    it('should merge with current settings and update the database', async () => {
      const getChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              readReceipts: false,
              enterToSend: false,
            },
          },
          error: null,
        }),
      };
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      mockFrom
        .mockReturnValueOnce(getChain)
        .mockReturnValueOnce(updateChain);

      const result = await service.updateSettings(userId, {
        readReceipts: true,
      });

      expect(result).toEqual({
        autoTranslate: true,
        readReceipts: true,
        enterToSend: false,
      });
      expect(updateChain.update).toHaveBeenCalledWith({ chat_preferences: result });
      expect(updateChain.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should throw an error if the database update fails', async () => {
      const getChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: false,
              readReceipts: false,
              enterToSend: false,
            },
          },
          error: null,
        }),
      };
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: new Error('DB write error') }),
      };
      mockFrom
        .mockReturnValueOnce(getChain)
        .mockReturnValueOnce(updateChain);

      await expect(
        service.updateSettings(userId, { autoTranslate: true }),
      ).rejects.toThrow('Failed to update chat settings: DB write error');
    });

    it('should allow partial updates and preserve other settings', async () => {
      const getChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              readReceipts: true,
              enterToSend: true,
            },
          },
          error: null,
        }),
      };
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      mockFrom
        .mockReturnValueOnce(getChain)
        .mockReturnValueOnce(updateChain);

      const result = await service.updateSettings(userId, {
        autoTranslate: false,
      });

      expect(result.autoTranslate).toBe(false);
      expect(result.readReceipts).toBe(true);
      expect(result.enterToSend).toBe(true);
    });
  });
});