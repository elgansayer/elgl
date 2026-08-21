import type { Mock, Mocked } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReadingEngineCrashReportService } from './reading-engine-crash-report.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ReadingEngineCrashReportService', () => {
  let service: ReadingEngineCrashReportService;
  let supabaseService: Mocked<Partial<SupabaseService>>;
  let mockInsert: Mock;
  let mockInsertSelect: Mock;
  let mockInsertSingle: Mock;
  let mockSelect: Mock;
  let mockUpdate: Mock;
  let mockEq: Mock;
  let mockIs: Mock;
  let mockOrder: Mock;
  let mockLimit: Mock;
  let mockFrom: Mock;

  beforeEach(async () => {
    // Build chainable query mocks
    mockInsertSingle = vi.fn();
    mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });

    mockInsert = vi.fn().mockReturnValue({
      select: mockInsertSelect,
    });

    mockLimit = vi.fn();
    mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    mockIs = vi.fn().mockReturnValue({ order: mockOrder });
    mockSelect = vi.fn().mockReturnValue({ is: mockIs });

    // Chainable eq for update/delete
    mockEq = vi.fn();

    const buildUpdateChain = (result: unknown) =>
      vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(result) });

    mockUpdate = vi.fn();

    mockFrom = vi.fn().mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      delete: vi.fn().mockReturnValue({ eq: mockEq }),
      eq: mockEq,
    });

    supabaseService = {
      getClient: vi.fn().mockReturnValue({
        from: mockFrom,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingEngineCrashReportService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: EventEmitter2, useValue: new EventEmitter2() },
      ],
    }).compile();

    service = module.get<ReadingEngineCrashReportService>(
      ReadingEngineCrashReportService,
    );
  });

  describe('reportCrash', () => {
    it('should persist a crash report and return the record', async () => {
      const mockDbRecord = {
        id: 'crash-001',
        operation: 'GET /reading/resources',
        user_id: 'user-123',
        resource_id: 'res-456',
        error_type: 'TypeError',
        error_message: 'Cannot read properties of undefined',
        stack_trace: 'Error: ...',
        context: { status_code: 500 },
        created_at: '2026-01-01T00:00:00.000Z',
        acknowledged: false,
        resolved_at: null,
      };

      mockInsertSingle.mockResolvedValueOnce({
        data: mockDbRecord,
        error: null,
      });

      const result = await service.reportCrash({
        operation: 'GET /reading/resources',
        user_id: 'user-123',
        resource_id: 'res-456',
        error_type: 'TypeError',
        error_message: 'Cannot read properties of undefined',
        stack_trace: 'Error: ...',
        context: { status_code: 500 },
      });

      expect(result).toBeDefined();
      expect(result?.id).toBe('crash-001');
      expect(result?.operation).toBe('GET /reading/resources');
      expect(result?.error_type).toBe('TypeError');
    });

    it('should return null when db insert returns an error', async () => {
      mockInsertSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB connection lost' },
      });

      const result = await service.reportCrash({
        operation: 'POST /reading/resources',
        error_type: 'DBError',
        error_message: 'test',
      });

      expect(result).toBeNull();
    });

    it('should return null when db insert throws', async () => {
      mockInsertSingle.mockRejectedValueOnce(new Error('Fatal DB error'));

      const result = await service.reportCrash({
        operation: 'DELETE /reading/resources',
        error_type: 'FatalError',
        error_message: 'test',
      });

      expect(result).toBeNull();
    });
  });

  describe('listUnresolved', () => {
    it('should return unresolved crash reports', async () => {
      const mockData = [
        {
          id: 'crash-001',
          operation: 'GET /reading/resources',
          user_id: 'user-1',
          resource_id: null,
          error_type: 'TypeError',
          error_message: 'error',
          stack_trace: null,
          context: null,
          created_at: '2026-01-01T00:00:00.000Z',
          acknowledged: false,
          resolved_at: null,
        },
      ];

      mockLimit.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await service.listUnresolved(10);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('crash-001');
    });

    it('should return empty array on db error', async () => {
      mockLimit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.listUnresolved();
      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockLimit.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await service.listUnresolved();
      expect(result).toEqual([]);
    });
  });

  describe('acknowledgeReport', () => {
    it('should acknowledge a crash report', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await service.acknowledgeReport('crash-001');
      expect(result).toBe(true);
    });

    it('should return false on db error', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Not found' } }),
      });

      const result = await service.acknowledgeReport('crash-999');
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('DB timeout')),
      });

      const result = await service.acknowledgeReport('crash-001');
      expect(result).toBe(false);
    });
  });

  describe('resolveReport', () => {
    it('should resolve a crash report', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await service.resolveReport('crash-001');
      expect(result).toBe(true);
    });

    it('should return false on exception', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('Timeout')),
      });

      const result = await service.resolveReport('crash-001');
      expect(result).toBe(false);
    });
  });
});
