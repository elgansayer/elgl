import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivacyService } from './privacy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

// Mock the sanitise-economy helper to avoid loading jsdom/dompurify ESM
// dependencies that the privacy spec does not need.
vi.mock('../economy/sanitise-economy.helper', () => ({
  sanitiseEconomyData: vi.fn((value: unknown) => value),
  scrubReceiptToken: vi.fn((token: string | null | undefined) => {
    if (token == null || token === '') return token as null;
    if (token.length < 8) return '[REDACTED-SHORT-TOKEN]';
    return '***...' + token.slice(-4);
  }),
  scrubCoinPurchaseForArchive: vi.fn(
    (
      record: Record<string, unknown> | null | undefined,
    ): Record<string, unknown> | null | undefined => {
      if (record == null) return record;
      const scrubbed = { ...record };
      for (const key of ['receipt_token', 'transaction_id']) {
        if (typeof scrubbed[key] === 'string') {
          const val = scrubbed[key];
          scrubbed[key] =
            val.length < 8
              ? '[REDACTED-SHORT-TOKEN]'
              : '***...' + val.slice(-4);
        }
      }
      return scrubbed;
    },
  ),
  scrubCoinPurchasesForArchive: vi.fn(
    (records: unknown[] | null | undefined): unknown[] | null | undefined => {
      if (records == null || !Array.isArray(records)) return records;
      return records.map((record) => {
        if (record !== null && typeof record === 'object') {
          const r = record as Record<string, unknown>;
          const scrubbed = { ...r };
          for (const key of ['receipt_token', 'transaction_id']) {
            if (typeof scrubbed[key] === 'string') {
              const val = scrubbed[key];
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
  scrubEscrowTransactionForArchive: vi.fn(
    (
      record: Record<string, unknown> | null | undefined,
    ): Record<string, unknown> | null | undefined => {
      if (record == null) return record;
      const scrubbed = { ...record };
      scrubbed['payer_id'] = '00000000-0000-0000-0000-000000000000';
      scrubbed['payee_id'] = '00000000-0000-0000-0000-000000000000';
      if (typeof scrubbed['description'] === 'string') {
        scrubbed['description'] = null;
      }
      if (typeof scrubbed['reference_id'] === 'string') {
        scrubbed['reference_id'] = null;
      }
      return scrubbed;
    },
  ),
  scrubEscrowTransactionsForArchive: vi.fn(
    (
      records: unknown[] | null | undefined,
      userId: string,
    ): Record<string, unknown>[] => {
      if (records == null || !Array.isArray(records)) return [];
      return records.map((record) => {
        if (record !== null && typeof record === 'object') {
          const r = record as Record<string, unknown>;
          const scrubbed = { ...r };
          scrubbed['payer_id'] =
            r['payer_id'] === userId
              ? userId
              : '00000000-0000-0000-0000-000000000000';
          scrubbed['payee_id'] =
            r['payee_id'] === userId
              ? userId
              : '00000000-0000-0000-0000-000000000000';
          scrubbed['description'] = null;
          scrubbed['reference_id'] = null;
          return scrubbed;
        }
        return record as Record<string, unknown>;
      });
    },
  ),
}));

describe('PrivacyService', () => {
  let service: PrivacyService;
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabaseClient = {
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    };

    mockFrom.mockImplementation((table: string) => {
      const defaultChain = {
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };

      return {
        select: vi.fn().mockReturnValue(defaultChain),
        insert: mockInsert,
        update: mockUpdate,
      };
    });

    mockInsert.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });

    // For collection queries (collectUserData):
    // Each from() call returns a new object, so mockFrom always returns a
    // fresh object.  collectUserData calls .from() many times, so we set up
    // mockFrom to return a helper that can handle each table name properly.
    mockFrom.mockImplementation((table: string) => {
      // Return empty data for economy tables we don't need to test in detail
      if (table === 'coin_purchases') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'gift_transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'escrow_transactions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === 'user_sticker_packs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
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
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    mockEq.mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
          useValue: { get: vi.fn() },
        },
        {
          provide: SafetyCacheInvalidationService,
          useValue: {
            invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
            invalidateTrustAndSafetyCaches: vi
              .fn()
              .mockResolvedValue(undefined),
            invalidateUserPairCaches: vi.fn().mockResolvedValue(undefined),
          },
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

    it('should set scheduled_for_deletion_at 30 days in the future and scrub location', async () => {
      const dto: DeleteAccountDto = { confirm_delete: true };
      mockEq.mockResolvedValue({ error: null });

      await service.deleteAccount('user-1', dto);

      expect(mockFrom).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalled();

      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.is_deletion_pending).toBe(true);
      expect(updateArg.privacy_hide_from_search).toBe(true);
      expect(updateArg.location).toBeNull();
      expect(updateArg.mock_location).toBeNull();
      expect(updateArg.mock_country).toBeNull();
      expect(updateArg.mock_city).toBeNull();
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
        eq: vi.fn().mockResolvedValue({ error: updateError }),
      });

      await expect(service.deleteAccount('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelDeletion', () => {
    it('should clear deletion fields', async () => {
      const mockEqCancel = vi.fn().mockResolvedValue({ error: null });
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
      const mockEqCancel = vi
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
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/archive.json' },
      });
      mockInsert.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      expect(mockUpload).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should include escrow transactions in the archive', async () => {
      // Override escrow_transactions mock to return data
      mockFrom.mockImplementation((table: string) => {
        const defaultChain = {
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };

        if (table === 'escrow_transactions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'esc_1',
                      payer_id: 'user-1',
                      payee_id: 'other-user',
                      amount_coins: 50,
                      status: 'held',
                      reason: 'Lesson payment',
                      metadata: { type: 'conversation' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
            insert: mockInsert,
            update: mockUpdate,
          };
        }

        return {
          select: vi.fn().mockReturnValue(defaultChain),
          insert: mockInsert,
          update: mockUpdate,
        };
      });

      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/archive.json' },
      });
      mockInsert.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await service.requestArchive('user-1', {
        receipt_id: null,
        app_store: null,
      });

      expect(mockUpload).toHaveBeenCalled();
      const uploadArgs = mockUpload.mock.calls[0];
      const jsonBlob = uploadArgs[1];
      const parsed = JSON.parse(jsonBlob);

      expect(parsed.escrow_transactions).toBeDefined();
      expect(Array.isArray(parsed.escrow_transactions)).toBe(true);
      expect(parsed.escrow_transactions.length).toBeGreaterThanOrEqual(1);

      const escrowRecord = parsed.escrow_transactions[0];
      expect(escrowRecord.id).toBe('esc_1');
      expect(escrowRecord.amount_coins).toBe(50);
      expect(escrowRecord.status).toBe('held');
      expect(escrowRecord.reason).toBe('Lesson payment');
      // Role tag should be present
      expect(escrowRecord.role).toBeDefined();
      expect(['payer', 'payee']).toContain(escrowRecord.role);
    });

    it('should include scrubbed coin purchases in the archive', async () => {
      // Override the coin_purchases mock to return sensitive data
      mockFrom.mockImplementation((table: string) => {
        const defaultChain = {
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };

        if (table === 'coin_purchases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
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
            insert: mockInsert,
            update: mockUpdate,
          };
        }

        return {
          select: vi.fn().mockReturnValue(defaultChain),
          insert: mockInsert,
          update: mockUpdate,
        };
      });

      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/archive.json' },
      });
      mockInsert.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
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
      mockUpload.mockResolvedValue({ error: { message: 'Upload failed' } });

      await expect(
        service.requestArchive('user-1', { receipt_id: null, app_store: null }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
