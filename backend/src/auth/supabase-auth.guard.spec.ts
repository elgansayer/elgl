import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let mockAuthGetUser: Mock;

  beforeEach(async () => {
    mockAuthGetUser = vi.fn();
    const mockSupabaseClient = {
      auth: {
        getUser: mockAuthGetUser,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockExecutionContext = (
    type: string,
    reqOrClient: any,
  ): ExecutionContext => {
    return {
      getType: vi.fn().mockReturnValue(type),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(reqOrClient),
      }),
      switchToWs: vi.fn().mockReturnValue({
        getClient: vi.fn().mockReturnValue(reqOrClient),
      }),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    describe('HTTP context', () => {
      it('should allow access and set user when valid Bearer token is provided', async () => {
        const mockUser = { id: 'user-123', email: 'test@hellotalk.com' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const request: any = {
          headers: {
            authorization: 'Bearer valid.jwt.token',
          },
        };
        const context = createMockExecutionContext('http', request);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('valid.jwt.token');
        expect(request.user).toEqual(mockUser);
      });

      it('accepts the case-insensitive Bearer authentication scheme', async () => {
        const mockUser = { id: 'user-123' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        const request: any = {
          headers: { authorization: 'bearer valid.jwt.token' },
        };

        await expect(
          guard.canActivate(createMockExecutionContext('http', request)),
        ).resolves.toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('valid.jwt.token');
      });

      it('should throw UnauthorizedException when authorization header is missing', async () => {
        const request: any = {
          headers: {},
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
        expect(mockAuthGetUser).not.toHaveBeenCalled();
      });

      it.each([
        'Basic some.token',
        'Bearer',
        'Bearer one two',
        'Token some.token',
      ])('rejects malformed authorization header %s', async (authorization) => {
        const request: any = { headers: { authorization } };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
        expect(mockAuthGetUser).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException when token validation fails with error', async () => {
        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Token expired'),
        });

        const request: any = {
          headers: {
            authorization: 'Bearer expired.jwt.token',
          },
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Invalid or expired token'),
        );
      });

      it('should throw UnauthorizedException when token validation returns null user', async () => {
        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request: any = {
          headers: {
            authorization: 'Bearer invalid.jwt.token',
          },
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Invalid or expired token'),
        );
      });

      it('fails closed when Supabase token validation throws', async () => {
        mockAuthGetUser.mockRejectedValue(new Error('provider unavailable'));
        const request: any = {
          headers: { authorization: 'Bearer opaque-token' },
        };

        await expect(
          guard.canActivate(createMockExecutionContext('http', request)),
        ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
        expect(request.user).toBeUndefined();
      });
    });

    describe('WebSocket context', () => {
      it('should allow access and set user when token is in handshake headers authorization', async () => {
        const mockUser = { id: 'ws-user-1', email: 'ws@hellotalk.com' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const client: any = {
          handshake: {
            headers: {
              authorization: 'Bearer ws.jwt.token',
            },
          },
        };
        const context = createMockExecutionContext('ws', client);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('ws.jwt.token');
        expect(client.user).toEqual(mockUser);
      });

      it('should allow access when token is in handshake auth object', async () => {
        const mockUser = { id: 'ws-user-2', email: 'ws2@hellotalk.com' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const client: any = {
          handshake: {
            auth: {
              token: 'ws.auth.token',
            },
          },
        };
        const context = createMockExecutionContext('ws', client);

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('ws.auth.token');
        expect(client.user).toEqual(mockUser);
      });

      it('rejects a non-Bearer websocket authorization header', async () => {
        const client: any = {
          handshake: {
            headers: { authorization: 'Basic ws.jwt.token' },
          },
        };

        await expect(
          guard.canActivate(createMockExecutionContext('ws', client)),
        ).rejects.toThrow(new UnauthorizedException('Missing authentication token'));
        expect(mockAuthGetUser).not.toHaveBeenCalled();
      });

      it('uses a valid handshake auth token when the websocket header is malformed', async () => {
        const mockUser = { id: 'ws-user-fallback' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });
        const client: any = {
          handshake: {
            headers: { authorization: 'Basic ignored' },
            auth: { token: 'ws.auth.token' },
          },
        };

        await expect(
          guard.canActivate(createMockExecutionContext('ws', client)),
        ).resolves.toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('ws.auth.token');
        expect(client.user).toEqual(mockUser);
      });

      it.each(['', '   ', 'two tokens'])(
        'rejects malformed websocket handshake auth token %j',
        async (token) => {
          const client: any = { handshake: { auth: { token } } };

          await expect(
            guard.canActivate(createMockExecutionContext('ws', client)),
          ).rejects.toThrow(new UnauthorizedException('Missing authentication token'));
          expect(mockAuthGetUser).not.toHaveBeenCalled();
        },
      );

      it('should throw UnauthorizedException when both header and auth token are missing in ws', async () => {
        const client: any = {
          handshake: {},
        };
        const context = createMockExecutionContext('ws', client);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
      });

      it('fails closed and does not attach a user when websocket validation throws', async () => {
        mockAuthGetUser.mockRejectedValue(new Error('provider unavailable'));
        const client: any = {
          handshake: { auth: { token: 'ws.auth.token' } },
        };

        await expect(
          guard.canActivate(createMockExecutionContext('ws', client)),
        ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
        expect(client.user).toBeUndefined();
      });
    });

    describe('Unsupported context', () => {
      it('should throw UnauthorizedException for unsupported execution context type', async () => {
        const context = createMockExecutionContext('rpc', {});

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Unsupported execution context'),
        );
      });
    });
  });
});
