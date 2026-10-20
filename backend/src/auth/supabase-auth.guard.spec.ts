import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
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
    vi.restoreAllMocks();
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

      it('accepts a case-insensitive Bearer scheme with optional surrounding whitespace', async () => {
        const mockUser = { id: 'user-124', email: 'case@hellotalk.com' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const request: any = {
          headers: {
            authorization: '  bearer   valid.jwt.token  ',
          },
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).resolves.toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('valid.jwt.token');
        expect(request.user).toEqual(mockUser);
      });

      it('should throw UnauthorizedException when authorization header is missing', async () => {
        const request: any = {
          headers: {},
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
      });

      it('should throw UnauthorizedException when authorization header is not Bearer format', async () => {
        const request: any = {
          headers: {
            authorization: 'Basic some.token',
          },
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
        expect(mockAuthGetUser).not.toHaveBeenCalled();
      });

      it('rejects ambiguous duplicate authorization headers', async () => {
        const request: any = {
          headers: {
            authorization: [
              'Bearer first.jwt.token',
              'Bearer second.jwt.token',
            ],
          },
        };
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

      it('fails closed with a stable error when Supabase verification throws', async () => {
        vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
        mockAuthGetUser.mockRejectedValue(new Error('provider unavailable'));

        const request: any = {
          headers: {
            authorization: 'Bearer valid-shape.jwt.token',
          },
          user: { id: 'stale-user' },
        };
        const context = createMockExecutionContext('http', request);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Unable to verify authentication token'),
        );
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

      it('does not treat a non-Bearer WebSocket authorization header as a JWT', async () => {
        const client: any = {
          handshake: {
            headers: {
              authorization: 'Basic basic-credential',
            },
          },
        };
        const context = createMockExecutionContext('ws', client);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
        expect(mockAuthGetUser).not.toHaveBeenCalled();
      });

      it('falls back to the explicit handshake auth token when the header is not Bearer', async () => {
        const mockUser = { id: 'ws-user-3', email: 'ws3@hellotalk.com' };
        mockAuthGetUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const client: any = {
          handshake: {
            headers: {
              authorization: 'Basic ignored-credential',
            },
            auth: {
              token: 'ws.fallback.token',
            },
          },
        };
        const context = createMockExecutionContext('ws', client);

        await expect(guard.canActivate(context)).resolves.toBe(true);
        expect(mockAuthGetUser).toHaveBeenCalledWith('ws.fallback.token');
        expect(client.user).toEqual(mockUser);
      });

      it('rejects non-string and whitespace-bearing handshake auth tokens', async () => {
        const clients = [
          { handshake: { auth: { token: 123 } } },
          { handshake: { auth: { token: 'two tokens' } } },
        ];

        for (const client of clients) {
          const context = createMockExecutionContext('ws', client);
          await expect(guard.canActivate(context)).rejects.toThrow(
            new UnauthorizedException('Missing authentication token'),
          );
        }

        expect(mockAuthGetUser).not.toHaveBeenCalled();
      });

      it('clears a stale authenticated WebSocket user before failed revalidation', async () => {
        mockAuthGetUser.mockResolvedValue({
          data: { user: null },
          error: new Error('expired'),
        });

        const client: any = {
          handshake: {
            auth: {
              token: 'expired.ws.token',
            },
          },
          user: { id: 'stale-user' },
        };
        const context = createMockExecutionContext('ws', client);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Invalid or expired token'),
        );
        expect(client.user).toBeUndefined();
      });

      it('should throw UnauthorizedException when both header and auth token are missing in ws', async () => {
        const client: any = {
          handshake: {},
        };
        const context = createMockExecutionContext('ws', client);

        await expect(guard.canActivate(context)).rejects.toThrow(
          new UnauthorizedException('Missing authentication token'),
        );
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
