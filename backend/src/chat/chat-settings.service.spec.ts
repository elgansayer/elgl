import type { Mock } from 'vitest';
import { Logger } from '@nestjs/common';
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
        textSize: 'medium',
        disappearingMessagesTtl: '7d',
      });
    });

    it.each(['small', 'medium', 'large'] as const)(
      'should return the stored %s chat text size',
      async (textSize) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { chat_preferences: { textSize } },
            error: null,
          }),
        };
        mockFrom.mockReturnValue(chain);

        await expect(service.getSettings(userId)).resolves.toMatchObject({
          textSize,
        });
      },
    );

    it.each([['huge'], [''], [null], [3], [{ size: 'large' }]])(
      'should fall back to the medium chat text size for the invalid stored value %j',
      async (textSize) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { chat_preferences: { textSize } },
            error: null,
          }),
        };
        mockFrom.mockReturnValue(chain);

        await expect(service.getSettings(userId)).resolves.toMatchObject({
          textSize: 'medium',
        });
      },
    );

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
        textSize: 'medium',
        disappearingMessagesTtl: '90d',
      });
      expect(updateChain.update).toHaveBeenCalledWith({
        chat_preferences: result,
      });
      expect(updateChain.eq).toHaveBeenCalledWith('id', userId);
    });

    it('should persist a chat text size and keep the other preferences', async () => {
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            chat_preferences: {
              autoTranslate: true,
              readReceipts: true,
              enterToSend: false,
              textSize: 'small',
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
        textSize: 'large',
      });

      expect(result).toEqual({
        autoTranslate: true,
        readReceipts: true,
        enterToSend: false,
        textSize: 'large',
        disappearingMessagesTtl: '7d',
      });
      expect(updateChain.update).toHaveBeenCalledWith({
        chat_preferences: result,
      });
    });

    it('should not disturb a stored chat text size when another setting changes', async () => {
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { chat_preferences: { textSize: 'large' } },
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
      });

      expect(result.textSize).toBe('large');
      expect(updateChain.update).toHaveBeenCalledWith({
        chat_preferences: expect.objectContaining({
          readReceipts: true,
          textSize: 'large',
        }),
      });
    });

    it('should be idempotent when the same chat text size is saved again', async () => {
      const stored = {
        autoTranslate: false,
        readReceipts: false,
        enterToSend: false,
        textSize: 'large',
        disappearingMessagesTtl: 'off',
      };
      const read = () => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { chat_preferences: stored },
          error: null,
        }),
      });
      const write = () => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom
        .mockReturnValueOnce(read())
        .mockReturnValueOnce(write())
        .mockReturnValueOnce(read())
        .mockReturnValueOnce(write());

      const first = await service.updateSettings(userId, {
        textSize: 'large',
      });
      const second = await service.updateSettings(userId, {
        textSize: 'large',
      });

      expect(second).toEqual(first);
      expect(second).toEqual(stored);
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
        eq: vi
          .fn()
          .mockResolvedValue({ error: new Error('sensitive DB write error') }),
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

  describe('failure diagnostics', () => {
    const providerError = Object.assign(
      new Error('relation secret_table contains private-value'),
      { code: '42703' },
    );
    let warn: Mock;

    beforeEach(() => {
      warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      warn.mockRestore();
    });

    it('logs a read failure with a correlatable provider code only', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: providerError }),
      });

      await expect(service.getSettings(userId)).rejects.toThrow(
        'Chat settings are temporarily unavailable',
      );

      expect(warn).toHaveBeenCalledExactlyOnceWith({
        event: 'chat_settings_store_failure',
        operation: 'read',
        providerCode: '42703',
      });
    });

    it('logs a write failure without the user, the payload or the provider message', async () => {
      const getChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { chat_preferences: {} }, error: null }),
      };
      const updateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: providerError }),
      };
      mockFrom.mockReturnValueOnce(getChain).mockReturnValueOnce(updateChain);

      await expect(
        service.updateSettings(userId, { textSize: 'large' }),
      ).rejects.toThrow('Chat settings could not be updated');

      expect(warn).toHaveBeenCalledExactlyOnceWith({
        event: 'chat_settings_store_failure',
        operation: 'write',
        providerCode: '42703',
      });
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).not.toContain(userId);
      expect(logged).not.toContain('private-value');
      expect(logged).not.toContain('large');
    });

    it('uses an explicit placeholder when the provider supplies no code', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: new Error('no code') }),
      });

      await expect(service.getSettings(userId)).rejects.toThrow();

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ providerCode: 'unknown' }),
      );
    });

    it('does not log anything when the store succeeds', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: { chat_preferences: null }, error: null }),
      });

      await service.getSettings(userId);

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
