import { Test, TestingModule } from '@nestjs/testing';
import { CrashReportService } from './crash-report.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('CrashReportService', () => {
  let service: CrashReportService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashReportService,
        {
          provide: 'PinoLogger:CrashReportService',
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<CrashReportService>(CrashReportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── reportCrash ──────────────────────────────────────────────

  describe('reportCrash', () => {
    const crashPayload = {
      operation: 'createEscrow',
      escrow_id: 'escrow-1',
      user_id: 'user-1',
      error_type: 'InternalServerError',
      error_message: 'Something went wrong',
      stack_trace: 'Error: Something went wrong\n    at ...',
      context: { foo: 'bar' },
    };

    it('should persist a crash report and return it', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'crash-1',
          operation: 'createEscrow',
          escrow_id: 'escrow-1',
          user_id: 'user-1',
          error_type: 'InternalServerError',
          error_message: 'Something went wrong',
          stack_trace: 'Error: Something went wrong\n    at ...',
          context: { foo: 'bar' },
          created_at: '2026-01-01T00:00:00Z',
          acknowledged: false,
          resolved_at: null,
        },
        error: null,
      });

      const result = await service.reportCrash(crashPayload);

      expect(result).toBeDefined();
      expect(result!.id).toBe('crash-1');
      expect(result!.operation).toBe('createEscrow');
      expect(result!.acknowledged).toBe(false);
      expect(result!.resolved_at).toBeNull();
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        operation: 'createEscrow',
        escrow_id: 'escrow-1',
        user_id: 'user-1',
        error_type: 'InternalServerError',
        error_message: 'Something went wrong',
        stack_trace: 'Error: Something went wrong\n    at ...',
        context: { foo: 'bar' },
        acknowledged: false,
      });
    });

    it('should return null when database insert fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.reportCrash(crashPayload);
      expect(result).toBeNull();
    });

    it('should return null when the supabase call throws', async () => {
      mockSupabaseClient.from = jest.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.reportCrash(crashPayload);
      expect(result).toBeNull();
    });
  });

  // ── listUnresolved ───────────────────────────────────────────

  describe('listUnresolved', () => {
    it('should return unresolved crash reports', async () => {
      mockQueryBuilder.limit = jest.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'crash-1',
            operation: 'createEscrow',
            escrow_id: 'escrow-1',
            user_id: 'user-1',
            error_type: 'RollbackFailure',
            error_message: 'Rollback failed',
            stack_trace: null,
            context: null,
            created_at: '2026-01-01T00:00:00Z',
            acknowledged: false,
            resolved_at: null,
          },
        ],
        error: null,
      });

      const result = await service.listUnresolved();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('crash-1');
      expect(result[0].acknowledged).toBe(false);
    });

    it('should return empty array when list fails', async () => {
      mockQueryBuilder.limit = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.listUnresolved();
      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockSupabaseClient.from = jest.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.listUnresolved();
      expect(result).toEqual([]);
    });
  });

  // ── acknowledgeReport ────────────────────────────────────────

  describe('acknowledgeReport', () => {
    it('should acknowledge a crash report', async () => {
      mockQueryBuilder.eq = jest.fn().mockResolvedValueOnce({
        error: null,
      });

      const result = await service.acknowledgeReport('crash-1');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.eq = jest.fn().mockResolvedValueOnce({
        error: { message: 'Not found' },
      });

      const result = await service.acknowledgeReport('crash-1');
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockQueryBuilder.eq = jest.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.acknowledgeReport('crash-1');
      expect(result).toBe(false);
    });
  });

  // ── resolveReport ────────────────────────────────────────────

  describe('resolveReport', () => {
    it('should resolve a crash report', async () => {
      mockQueryBuilder.eq = jest.fn().mockResolvedValueOnce({
        error: null,
      });

      const result = await service.resolveReport('crash-1');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.eq = jest.fn().mockResolvedValueOnce({
        error: { message: 'Not found' },
      });

      const result = await service.resolveReport('crash-1');
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockQueryBuilder.eq = jest.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.resolveReport('crash-1');
      expect(result).toBe(false);
    });
  });
});