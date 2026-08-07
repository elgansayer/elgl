import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConfigService } from '@nestjs/config';
import { PrivacyService } from './privacy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

// Mock the sanitise-economy helper to avoid loading jsdom/dompurify ESM
// dependencies that the privacy spec does not need.
jest.mock('../economy/sanitise-economy.helper', () => ({
  sanitiseEconomyData: jest.fn((value: unknown) => value),
  scrubReceiptToken: jest.fn((token: string | null | undefined) => {
    if (token == null || token === '') return token as null;
    if (token.length < 8) return '[REDACTED-SHORT-TOKEN]';
    return '***...' + token.slice(-4);
  }),
  scrubCoinPurchaseForArchive: jest.fn(
    (
      record: Record<string, unknown> | null | undefined,
    ): Record<string, unknown> | null | undefined => {
      if (record == null) return record;
      const scrubbed = { ...record };
      for (const key of ['receipt_token', 'transaction_id']) {
        if (typeof scrubbed[key] === 'string') {
          const val = scrubbed[key] as string;
          scrubbed[key] =
            val.length < 8
              ? '[REDACTED-SHORT-TOKEN]'
              : '***...' + val.slice(-4);
        }
      }
      return scrubbed;
    },
  ),
  scrubCoinPurchasesForArchive: jest.fn(
    (
      records: unknown[] | null | undefined,
    ): unknown[] | null | undefined => {
      if (records == null || !Array.isArray(records)) return records;
      return records.map((record) => {
        if (record !== null && typeof record === 'object') {
          const r = record as Record<string, unknown>;
          const scrubbed = { ...r };
          for (const key of ['receipt_token', 'transaction_id']) {
            if (typeof scrubbed[key] === 'string') {
              const val = scrubbed[key] as string;
              scrubbed[key] =
                val.length < 8
                  ? '[REDACTED-SHORT-TOKEN]'
                  : '***...' + val.slice(-4);
            }
          }
          return scrubbed;
        }
        return record;
      });
    },
  ),
}));

describe('PrivacyService', () => {
  let service: PrivacyService;
  const mockFrom = jest.fn();
  const mockSelect = jest.fn();
  const mockEq = jest.fn();
  const mockSingle = jest.fn();
  const mockOrder = jest.fn();
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();
  const mockUpload = jest.fn();
  const mockGetPublicUrl = jest.fn();

  // Helper function to create a fresh mock chain that returns resolved data.
  const makeEqMock = (resolveData: unknown) =>
    jest.fn().mockResolvedValue({ data: resolveData, error: null });

  const makeOrderMock = (resolveData: unknown) =>
    jest.fn().mockReturnValue({
      eq: makeEqMock(resolveData),
    });

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockSupabaseClient = {
      from: mockFrom,
      storage: {
        from: jest.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    };

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });

    mockInsert.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });

    // For collection queries (collectUserData):
    // Each from() call returns a new object, so mockFrom always returns a
    // fresh object.  collectUserData calls .from() many times, so we set up
    // mockFrom to return a helper that can handle each table name properly.
    mockFrom.mockImplementation((table: string) => {
      // Return empty data for economy and classroom tables we don't need
      // to test in detail in most specs
      const emptyOrderEq = jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });
      const emptyOrderOr = jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      if (
        table === 'coin_purchases' ||
        table === 'gift_transactions' ||
        table === 'user_sticker_packs'
      ) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'call_logs') {
        return {
          select: jest.fn().mockReturnValue({
            or: emptyOrderOr,
          }),
        };
      }
      if (table === 'audio_room_captions') {
        return {
          select: jest.fn().mockReturnValue({
            eq: emptyOrderEq,
          }),
        };
      }
      if (table === 'audio_room_notes') {
        return {
          select: jest.fn().mockReturnValue({
            eq: emptyOrderEq,
          }),
        };
      }
      // Default for users, moments, moment_comments, chat_messages,
      // flashcards, decks, deck_flashcards, favourites
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      // For deck_flashcards .in() call
      in: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    mockEq.mockReturnValue({
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deleteAccount', () => {
    it('should throw if confirm_delete is false', async () => {
      const dto: DeleteAccountDto = { confirm_delete: false };
      await expect(service.deleteAccount('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set scheduled_for_deletion_at 30 days in the future', async () => {
      const dto: DeleteAccountDto = { confirm_delete: true };
      mockEq.mockResolvedValue({ error: null });

      await service.deleteAccount('user-1', dto);

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalled();

      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.is_deletion_pending).toBe(true);
      expect(updateArg.scheduled_for_deletion_at).toBeDefined();
      expect(updateArg.deletion_requested_at).toBeDefined();

      // Verify the scheduled date is ~30 days in the future
      const scheduledDate = new Date(updateArg.scheduled_for_deletion_at);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);
      const diffDays = Math.abs(
        (scheduledDate.getTime() - expectedDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBeLessThan(0.01); // Should be within a few seconds

      expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    });

    it('should throw BadRequestException on update error', async () => {
      const dto: DeleteAccountDto = { confirm_delete: true };
      const updateError = { message: 'DB error' };
      mockUpdate.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: updateError }),
      });

      await expect(service.deleteAccount('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelDeletion', () => {
    it('should clear deletion fields', async () => {
      const mockEqCancel = jest.fn().mockResolvedValue({ error: null });
      mockUpdate.mockReturnValue({ eq: mockEqCancel });

      await service.cancelDeletion('user-1');

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith({
        scheduled_for_deletion_at: null,
        deletion_requested_at: null,
        is_deletion_pending: false,
      });
      expect(mockEqCancel).toHaveBeenCalledWith('id', 'user-1');
    });

    it('should throw BadRequestException on error', async () => {
      const mockEqCancel = jest
        .fn()
        .mockResolvedValue({ error: { message: 'DB error' } });
      mockUpdate.mockReturnValue({ eq: mockEqCancel });

      await expect(service.cancelDeletion('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('requestArchive', () => {
    it('should handle archive creation', async () => {
      // Set up mock chains for collectUserData
      // Each data fetch returns empty data
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/archive.json' },
      });
      mockInsert.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      expect(mockUpload).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should include scrubbed coin purchases in the archive', async () => {
      // Override the coin_purchases mock to return sensitive data
      mockFrom.mockImplementation((table: string) => {
        if (table === 'coin_purchases') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'cp_1',
                      user_id: 'user-1',
                      receipt_token: 'cs_test_sensitive_session_abc123',
                      transaction_id: 'txn_long_transaction_id_xyz789',
                      status: 'completed',
                      coins_added: 100,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'gift_transactions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'user_sticker_packs') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'call_logs') {
          return {
            select: jest.fn().mockReturnValue({
              or: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'audio_room_captions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'audio_room_notes') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {
          select: mockSelect,
          insert: mockInsert,
          update: mockUpdate,
        };
      });

      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/archive.json' },
      });
      mockInsert.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });

      // The upload call contains the JSON blob. We can inspect mockUpload to
      // verify the scrubbing happened.
      await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      expect(mockUpload).toHaveBeenCalled();
      const uploadArgs = mockUpload.mock.calls[0];
      const jsonBlob = uploadArgs[1];
      expect(typeof jsonBlob).toBe('string');

      const parsed = JSON.parse(jsonBlob);
      expect(parsed.coin_purchases).toBeDefined();
      expect(Array.isArray(parsed.coin_purchases)).toBe(true);

      const purchaseRecord = parsed.coin_purchases[0];
      // receipt_token should be scrubbed (only last 4 chars)
      expect(purchaseRecord.receipt_token).toBe('***...c123');
      // transaction_id should be scrubbed
      expect(purchaseRecord.transaction_id).toBe('***...z789');
      // Non-sensitive fields preserved
      expect(purchaseRecord.id).toBe('cp_1');
      expect(purchaseRecord.status).toBe('completed');
      expect(purchaseRecord.coins_added).toBe(100);
    });

    it('should throw BadRequestException on upload error', async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          order: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      mockUpload.mockResolvedValue({ error: { message: 'Upload failed' } });

      await expect(
        service.requestArchive('user-1', { receipt_id: null, app_store: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
