import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ChatBackupService } from './chat-backup.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ChatBackupService', () => {
  let service: ChatBackupService;
  let supabaseService: { getClient: Mock };

  beforeEach(async () => {
    supabaseService = {
      getClient: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatBackupService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<ChatBackupService>(ChatBackupService);
    // Mock the logger to prevent console spam
    vi.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBackup', () => {
    it('should format messages correctly', async () => {
      const mockData = [
        { created_at: '2023-01-01', sender: 'Alice', content: 'Hello' },
        { created_at: '2023-01-02', sender: 'Alice', content: 'World' },
      ];

      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: mockData, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      supabaseService.getClient.mockReturnValue({ from: mockFrom });

      const result = await service.createBackup('user-123');
      expect(result).toContain('Backup Start');
      expect(result).toContain('[2023-01-01] Alice: Hello');
      expect(result).toContain('[2023-01-02] Alice: World');
      expect(result).toContain('Backup End');
    });

    it('should return empty string if no data', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ order: mockOrder }),
          }),
        }),
      });

      const result = await service.createBackup('user-123');
      expect(result).toBe('');
    });

    it('should throw and log if error occurs', async () => {
      const mockError = { message: 'DB Error' };
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: mockError });
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ order: mockOrder }),
          }),
        }),
      });

      await expect(service.createBackup('user-123')).rejects.toThrow(
        'DB Error',
      );
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Backup failed for user user-123: DB Error',
      );
    });
  });

  describe('exportChannelBackup', () => {
    it('should export messages successfully', async () => {
      const mockChannelId = 'channel-123';
      const mockMessages = [
        { id: 'msg-1', content: 'hello' },
        { id: 'msg-2', content: 'world' },
      ];

      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: mockMessages, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

      supabaseService.getClient.mockReturnValue({ from: mockFrom });

      const result = await service.exportChannelBackup(mockChannelId);

      expect(result).toEqual(mockMessages);
      expect(mockFrom).toHaveBeenCalledWith('chat_messages');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('channel_id', mockChannelId);
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('should return empty array if data is null', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: mockOrder,
            }),
          }),
        }),
      });

      const result = await service.exportChannelBackup('channel-123');
      expect(result).toEqual([]);
    });

    it('should throw an error and log if export fails', async () => {
      const mockError = { message: 'Export error' };
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: mockError });
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: mockOrder,
            }),
          }),
        }),
      });

      await expect(service.exportChannelBackup('channel-123')).rejects.toThrow(
        'Export error',
      );
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Export failed for channel channel-123: Export error',
      );
    });
  });

  describe('importChannelBackup', () => {
    it('should import messages in single chunk', async () => {
      const mockChannelId = 'channel-123';
      const mockMessages = [
        { id: '1', content: 'a', sender: 'x' },
        { id: '2', content: 'b', sender: 'y' },
      ];

      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'new-1' }, { id: 'new-2' }],
        error: null,
      });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      supabaseService.getClient.mockReturnValue({ from: mockFrom });

      const result = await service.importChannelBackup(
        mockChannelId,
        mockMessages,
      );

      expect(result).toBe(2);
      expect(mockFrom).toHaveBeenCalledWith('chat_messages');
      // Should strip 'id' and add 'channel_id'
      expect(mockInsert).toHaveBeenCalledWith([
        { content: 'a', sender: 'x', channel_id: mockChannelId },
        { content: 'b', sender: 'y', channel_id: mockChannelId },
      ]);
    });

    it('should import messages in multiple chunks of 500', async () => {
      const mockChannelId = 'channel-123';
      const mockMessages = Array.from({ length: 1200 }, (_, i) => ({
        id: `old-${i}`,
        val: i,
      }));

      const mockSelect = vi
        .fn()
        .mockResolvedValueOnce({
          data: Array(500).fill({ id: 'new' }),
          error: null,
        })
        .mockResolvedValueOnce({
          data: Array(500).fill({ id: 'new' }),
          error: null,
        })
        .mockResolvedValueOnce({
          data: Array(200).fill({ id: 'new' }),
          error: null,
        });

      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      supabaseService.getClient.mockReturnValue({ from: mockFrom });

      const result = await service.importChannelBackup(
        mockChannelId,
        mockMessages,
      );

      expect(result).toBe(1200);
      expect(mockInsert).toHaveBeenCalledTimes(3);

      const firstChunk = mockInsert.mock.calls[0][0];
      expect(firstChunk).toHaveLength(500);
      expect(firstChunk[0]).not.toHaveProperty('id');
      expect(firstChunk[0]).toHaveProperty('channel_id', mockChannelId);

      const thirdChunk = mockInsert.mock.calls[2][0];
      expect(thirdChunk).toHaveLength(200);
    });

    it('should throw an error and log if insert fails', async () => {
      const mockMessages = Array.from({ length: 600 }, (_, i) => ({
        id: `old-${i}`,
        val: i,
      }));
      const mockError = { message: 'Insert failed' };

      const mockSelect = vi
        .fn()
        .mockResolvedValueOnce({
          data: Array(500).fill({ id: 'new' }),
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: mockError });

      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      });

      await expect(
        service.importChannelBackup('channel-123', mockMessages),
      ).rejects.toThrow('Insert failed');

      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(service['logger'].error).toHaveBeenCalledWith(
        'Import failed for chunk starting at index 500: Insert failed',
      );
    });

    it('should add up correctly when data is null but error is null', async () => {
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      supabaseService.getClient.mockReturnValue({
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      });

      const result = await service.importChannelBackup('channel-123', [
        { id: '1' },
      ]);
      expect(result).toBe(0);
    });
  });
});
