import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatSettingsService } from './chat-settings.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatSettingsService', () => {
  let service: ChatSettingsService;
  let supabaseServiceMock: { getClient: Mock };
  let mockFrom: Mock;
  let mockRpc: Mock;
  const userId = 'test-user-id';

  beforeEach(async () => {
    supabaseServiceMock = {
      getClient: vi.fn(),
    };
    mockFrom = vi.fn();
    mockRpc = vi.fn();
    supabaseServiceMock.getClient.mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
    });

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
        textSize: 'medium',
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
              textSize: 'large',
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
        textSize: 'large',
        disappearingMessagesTtl: '7d',
      });
    });

    it('should fall back to medium for an invalid stored text size', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              textSize: 'extra-large',
            },
          },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(chain);

      await expect(service.getSettings(userId)).resolves.toMatchObject({
        textSize: 'medium',
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
    it('atomically merges the partial settings patch in the database', async () => {
      mockRpc.mockResolvedValue({
        data: {
          autoTranslate: true,
          readReceipts: true,
          enterToSend: false,
          textSize: 'large',
          disappearingMessagesTtl: '90d',
        },
        error: null,
      });

      const result = await service.updateSettings(userId, {
        readReceipts: true,
        textSize: 'large',
        disappearingMessagesTtl: '90d',
      });

      expect(result).toEqual({
        autoTranslate: true,
        readReceipts: true,
        enterToSend: false,
        textSize: 'large',
        disappearingMessagesTtl: '90d',
      });
      expect(mockRpc).toHaveBeenCalledWith('merge_chat_preferences', {
        p_user_id: userId,
        p_patch: {
          readReceipts: true,
          textSize: 'large',
          disappearingMessagesTtl: '90d',
        },
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should return a sanitized failure if the database update fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: new Error('sensitive DB write error'),
      });

      await expect(
        service.updateSettings(userId, { autoTranslate: true }),
      ).rejects.toThrow('Chat settings could not be updated');
    });

    it('returns the complete merged state from the atomic update', async () => {
      mockRpc.mockResolvedValue({
        data: {
          autoTranslate: false,
          readReceipts: true,
          enterToSend: true,
          textSize: 'small',
          disappearingMessagesTtl: '7d',
        },
        error: null,
      });

      const result = await service.updateSettings(userId, {
        autoTranslate: false,
      });

      expect(result.autoTranslate).toBe(false);
      expect(result.readReceipts).toBe(true);
      expect(result.enterToSend).toBe(true);
      expect(result.textSize).toBe('small');
      expect(result.disappearingMessagesTtl).toBe('7d');
    });
  });
});
