import type { Mocked } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseService } from '../../supabase/supabase.service';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let supabaseService: Mocked<SupabaseService>;

  beforeEach(() => {
    supabaseService = {
      getClient: vi.fn(),
    } as any;
    guard = new SupabaseAuthGuard(supabaseService);
  });

  const mockExecutionContext = (headers: any = {}): ExecutionContext => {
    return {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({ headers }),
      }),
    } as any;
  };

  it('should throw UnauthorizedException if authorization header is missing', async () => {
    const context = mockExecutionContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Missing authorization header'),
    );
  });

  it('should throw UnauthorizedException if authorization header is an array (invalid format)', async () => {
    const context = mockExecutionContext({ authorization: ['Bearer token'] });

    const mockAuth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    };
    supabaseService.getClient.mockReturnValue({ auth: mockAuth } as any);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token'),
    );
    expect(mockAuth.getUser).toHaveBeenCalledWith('');
  });

  it('should throw UnauthorizedException if token is invalid (no user returned)', async () => {
    const context = mockExecutionContext({
      authorization: 'Bearer invalid-token',
    });

    const mockAuth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    };

    supabaseService.getClient.mockReturnValue({ auth: mockAuth } as any);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token'),
    );
    expect(mockAuth.getUser).toHaveBeenCalledWith('invalid-token');
  });

  it('should throw UnauthorizedException if getUser throws an error', async () => {
    const context = mockExecutionContext({
      authorization: 'Bearer error-token',
    });

    const mockAuth = {
      getUser: vi.fn().mockRejectedValue(new Error('Some error')),
    };

    supabaseService.getClient.mockReturnValue({ auth: mockAuth } as any);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid token'),
    );
    expect(mockAuth.getUser).toHaveBeenCalledWith('error-token');
  });

  it('should set request.user and return true if token is valid', async () => {
    const request = { headers: { authorization: 'Bearer valid-token' } };
    const context = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
    } as any;

    const mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
      }),
    };

    supabaseService.getClient.mockReturnValue({ auth: mockAuth } as any);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect((request as any).user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
    });
    expect(mockAuth.getUser).toHaveBeenCalledWith('valid-token');
  });
});
