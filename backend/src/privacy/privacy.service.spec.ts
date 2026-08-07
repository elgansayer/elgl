import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConfigService } from '@nestjs/config';
import { PrivacyService } from './privacy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

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

    // For collection queries (collectUserData)
    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
    });
    mockEq.mockReturnValue({ single: mockSingle, order: mockOrder });
    mockOrder.mockReturnValue({ eq: mockEq });
    mockSingle.mockReturnValue({ data: null, error: null });

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
