import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminCapabilityGuard } from './guards/admin-capability.guard';
import { AdminGuard } from './guards/admin.guard';
import { CacheControlInterceptor } from '../common/cache.interceptor';

function createMockContext(): {
  executionContext: ExecutionContext;
  setHeader: Mock;
  response: Record<string, unknown>;
} {
  const setHeader = vi.fn();
  const removeHeader = vi.fn();
  const response = { setHeader, removeHeader };
  const request = { headers: {} };

  const executionContext = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ExecutionContext;

  return { executionContext, setHeader, response };
}

function capturedHeaders(setHeader: Mock): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const call of setHeader.mock.calls) {
    headers[call[0]] = call[1];
  }
  return headers;
}

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            listUsers: vi.fn(),
            setVipStatus: vi.fn(),
            getLoginHistory: vi.fn(),
            listAllBlocks: vi.fn(),
            removeBlock: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(AdminCapabilityGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listUsers', () => {
    it('delegates to AdminService.listUsers with the query params', async () => {
      const response = { users: [], total: 0, page: 1, pageSize: 20 };
      (adminService.listUsers as Mock).mockResolvedValue(response);

      const result = await controller.listUsers({ page: 1, pageSize: 20 });

      expect(adminService.listUsers).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual(response);
    });
  });

  describe('setVipStatus', () => {
    it('delegates to AdminService.setVipStatus', async () => {
      const response = { id: 'user-1', is_vip: true };
      (adminService.setVipStatus as Mock).mockResolvedValue(response);

      const result = await controller.setVipStatus('user-1', {
        is_vip: true,
      });

      expect(adminService.setVipStatus).toHaveBeenCalledWith('user-1', {
        is_vip: true,
      });
      expect(result).toEqual(response);
    });
  });

  describe('getLoginHistory', () => {
    it('delegates to AdminService.getLoginHistory', async () => {
      const history = [{ id: 'log-1' }];
      (adminService.getLoginHistory as Mock).mockResolvedValue(history);

      const result = await controller.getLoginHistory('user-1');

      expect(adminService.getLoginHistory).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(history);
    });
  });

  describe('listAllBlocks', () => {
    it('delegates to AdminService.listAllBlocks with default page params', async () => {
      const response = { blocks: [], total: 0, page: 1, pageSize: 20 };
      (adminService.listAllBlocks as Mock).mockResolvedValue(response);

      const result = await controller.listAllBlocks(undefined, undefined);

      expect(adminService.listAllBlocks).toHaveBeenCalledWith(1, 20);
      expect(result).toEqual(response);
    });

    it('parses page and pageSize query params', async () => {
      const response = { blocks: [], total: 0, page: 2, pageSize: 10 };
      (adminService.listAllBlocks as Mock).mockResolvedValue(response);

      const result = await controller.listAllBlocks('2', '10');

      expect(adminService.listAllBlocks).toHaveBeenCalledWith(2, 10);
      expect(result).toEqual(response);
    });
  });

  describe('removeBlock', () => {
    it('delegates to AdminService.removeBlock with the block id', async () => {
      (adminService.removeBlock as vi.Mock).mockResolvedValue({
        success: true,
      });

      const result = await controller.removeBlock('block-42');

      expect(adminService.removeBlock).toHaveBeenCalledWith('block-42');
      expect(result).toEqual({ success: true });
    });
  });

  describe('Cloudflare edge caching headers', () => {
    it('sets private no-store headers on mutation endpoints', () => {
      const noStoreInterceptor = new CacheControlInterceptor({
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'private, no-store',
      });
      const { executionContext, setHeader } = createMockContext();
      const callHandler: CallHandler = { handle: () => of(null) };

      noStoreInterceptor.intercept(executionContext, callHandler).subscribe();

      const headers = capturedHeaders(setHeader);
      expect(headers['Cache-Control']).toBe(
        'private, no-store, no-cache, must-revalidate',
      );
      expect(headers['CDN-Cache-Control']).toBe('private, no-store');
    });

    it('sets private medium-cache headers on read endpoints', () => {
      const mediumInterceptor = new CacheControlInterceptor({
        'Cache-Control':
          'private, max-age=60, s-maxage=300, stale-while-revalidate=120, stale-if-error=600',
        'CDN-Cache-Control': 'private, max-age=300, stale-while-revalidate=120',
      });
      const { executionContext, setHeader } = createMockContext();
      const callHandler: CallHandler = { handle: () => of(null) };

      mediumInterceptor.intercept(executionContext, callHandler).subscribe();

      const headers = capturedHeaders(setHeader);
      expect(headers['Cache-Control']).toContain('private');
      expect(headers['Cache-Control']).toContain('max-age=60');
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=120');
      expect(headers['CDN-Cache-Control']).toContain('private');
      expect(headers['CDN-Cache-Control']).toContain('max-age=300');
    });

    it('overrides cache headers to no-store on error from any endpoint', () => {
      const interceptor = new CacheControlInterceptor({
        'Cache-Control': 'private, max-age=60',
        'CDN-Cache-Control': 'private, max-age=300',
      });
      const { executionContext, setHeader } = createMockContext();
      const callHandler: CallHandler = {
        handle: () => throwError(() => new Error('simulated failure')),
      };

      interceptor.intercept(executionContext, callHandler).subscribe({
        error: () => {
          /* expected */
        },
      });

      // After error, headers should be overridden to no-store
      const headers = capturedHeaders(setHeader);
      expect(headers['Cache-Control']).toBe('private, no-store');
      expect(headers['CDN-Cache-Control']).toBe('private, no-store');
    });
  });
});
