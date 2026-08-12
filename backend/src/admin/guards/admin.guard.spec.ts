import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { SupabaseService } from '../../supabase/supabase.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let mockQueryBuilder: any;
  let mockSupabaseClient: any;

  const buildContext = (user?: { id: string }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    guard = new AdminGuard({
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    } as unknown as SupabaseService);
  });

  it('throws UnauthorizedException when no user is on the request', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when the user is not an admin', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: { is_admin: false },
      error: null,
    });

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the lookup errors', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    });

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows the request when the user is an admin', async () => {
    mockQueryBuilder.single.mockResolvedValue({
      data: { is_admin: true },
      error: null,
    });

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).resolves.toBe(true);
  });
});
