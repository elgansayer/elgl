import type { Mock } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatSettingsService } from './chat-settings.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatSettingsService', () => {
  let service: ChatSettingsService;
  let supabaseServiceMock: { getClient: Mock };
  let mockFrom: Mock;
  const userId = 'test-user-id';

  beforeEach(async () => {
    supabaseServiceMock = { getClient: vi.fn() };
    mockFrom = vi.fn();
    supabaseServiceMock.getClient.mockReturnValue({ from: mockFrom });

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ChatSettingsService,
        { provide: SupabaseService, useValue: supabaseServiceMock },
      ],
    }).compile();

    service = moduleRef.get(ChatSettingsService);
  });

  afterEach(() => vi.clearAllMocks());

  function getChain(data: Record<string, unknown> | null, error: unknown = null) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error }),
    };
  }

  it('returns privacy-safe defaults with message filtering disabled', async () => {
    mockFrom.mockReturnValue(
      getChain({ chat_preferences: null, message_filters: null }),
    );

    const result = await service.getSettings(userId);

    expect(result).toMatchObject({
      autoTranslate: false,
      readReceipts: false,
      enterToSend: false,
      messageFilters: {
        enabled: false,
        allowEveryone: true,
        allowedGenders: [],
        sameNativeLanguage: false,
        sameTargetLanguage: false,
        sameGender: false,
        sameAge: false,
      },
    });
  });

  it('merges persisted chat and message privacy preferences', async () => {
    mockFrom.mockReturnValue(
      getChain({
        chat_preferences: { autoTranslate: true, enterToSend: true },
        message_filters: {
          enabled: true,
          allowEveryone: false,
          sameTargetLanguage: true,
          allowedGenders: ['Woman'],
        },
      }),
    );

    const result = await service.getSettings(userId);

    expect(result.autoTranslate).toBe(true);
    expect(result.enterToSend).toBe(true);
    expect(result.messageFilters).toMatchObject({
      enabled: true,
      allowEveryone: false,
      sameTargetLanguage: true,
      allowedGenders: ['woman'],
    });
  });

  it('persists filters separately from chat presentation preferences', async () => {
    const read = getChain({
      chat_preferences: {
        autoTranslate: true,
        readReceipts: false,
        enterToSend: false,
      },
      message_filters: { enabled: false, allowEveryone: true },
    });
    const write = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValueOnce(read).mockReturnValueOnce(write);

    const result = await service.updateSettings(userId, {
      readReceipts: true,
      messageFilters: {
        enabled: true,
        sameNativeLanguage: true,
        ageMin: 25,
        ageMax: 40,
      },
    });

    expect(result.messageFilters).toMatchObject({
      enabled: true,
      allowEveryone: false,
      sameNativeLanguage: true,
      ageMin: 25,
      ageMax: 40,
    });
    expect(write.update).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_preferences: expect.objectContaining({ readReceipts: true }),
        message_filters: expect.objectContaining({
          enabled: true,
          allowEveryone: false,
          sameNativeLanguage: true,
          ageMin: 25,
          ageMax: 40,
        }),
      }),
    );
  });

  it('normalizes gender values and leaves Everyone when a restriction is selected', async () => {
    const read = getChain({
      chat_preferences: {},
      message_filters: { enabled: false, allowEveryone: true },
    });
    const write = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValueOnce(read).mockReturnValueOnce(write);

    const result = await service.updateSettings(userId, {
      messageFilters: {
        enabled: true,
        allowedGenders: [' Woman ', 'woman', 'MAN'],
      },
    });

    expect(result.messageFilters?.allowEveryone).toBe(false);
    expect(result.messageFilters?.allowedGenders).toEqual(['woman', 'man']);
  });

  it('rejects an inverted age range before writing', async () => {
    mockFrom.mockReturnValue(
      getChain({
        chat_preferences: {},
        message_filters: { enabled: false, allowEveryone: true },
      }),
    );

    await expect(
      service.updateSettings(userId, {
        messageFilters: { enabled: true, ageMin: 50, ageMax: 20 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('surfaces database write failures', async () => {
    const read = getChain({ chat_preferences: {}, message_filters: null });
    const write = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: new Error('DB write error') }),
    };
    mockFrom.mockReturnValueOnce(read).mockReturnValueOnce(write);

    await expect(
      service.updateSettings(userId, { autoTranslate: true }),
    ).rejects.toThrow('Failed to update chat settings: DB write error');
  });
});
