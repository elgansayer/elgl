import type { Mock } from 'vitest';
import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of } from 'rxjs';
import { LastActiveInterceptor } from './last-active.interceptor';
import { SupabaseService } from '../../supabase/supabase.service';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('LastActiveInterceptor', () => {
  let interceptor: LastActiveInterceptor;
  let singleMock: Mock;
  let updateMock: Mock;
  let updateEqMock: Mock;
  let insertMock: Mock;
  let fromMock: Mock;
  let handler: CallHandler;

  const buildContext = (request: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    singleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    updateEqMock = vi.fn().mockResolvedValue({ error: null });
    insertMock = vi.fn().mockResolvedValue({ error: null });
    updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    const usersTable = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: singleMock }),
      }),
      update: updateMock,
    };
    const loginHistoryTable = { insert: insertMock };

    fromMock = vi.fn((table: string) =>
      table === 'users' ? usersTable : loginHistoryTable,
    );

    const supabaseService = {
      getClient: vi.fn().mockReturnValue({ from: fromMock }),
    } as unknown as SupabaseService;

    interceptor = new LastActiveInterceptor(supabaseService);
    handler = { handle: vi.fn(() => of('response')) };

    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('passes the request through to the next handler', () => {
    const result = interceptor.intercept(
      buildContext({ headers: {} }),
      handler,
    );

    expect(handler.handle).toHaveBeenCalled();
    result.subscribe();
  });

  it('does not touch supabase when the request has no authenticated user', async () => {
    interceptor.intercept(buildContext({ headers: {} }), handler);
    await flushPromises();

    expect(fromMock).not.toHaveBeenCalled();
  });

  describe('when the request has an authenticated user', () => {
    const request = {
      user: { id: 'user-1' },
      ip: '1.2.3.4',
      headers: { 'user-agent': 'test-agent' },
    };

    it('updates last_active_at for the user', async () => {
      interceptor.intercept(buildContext(request), handler);
      await flushPromises();

      expect(fromMock).toHaveBeenCalledWith('users');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({ last_active_at: expect.any(String) }),
      );
      expect(updateEqMock).toHaveBeenCalledWith('id', 'user-1');
    });

    it('records login history when there is no previous activity', async () => {
      singleMock.mockResolvedValue({ data: { last_active_at: null } });

      interceptor.intercept(buildContext(request), handler);
      await flushPromises();

      expect(fromMock).toHaveBeenCalledWith('login_history');
      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-1',
        ip_address: '1.2.3.4',
        user_agent: 'test-agent',
      });
    });

    it('records login history when the previous session gap exceeds four hours', async () => {
      const fiveHoursAgo = new Date(
        Date.now() - 5 * 60 * 60 * 1000,
      ).toISOString();
      singleMock.mockResolvedValue({
        data: { last_active_at: fiveHoursAgo },
      });

      interceptor.intercept(buildContext(request), handler);
      await flushPromises();

      expect(insertMock).toHaveBeenCalled();
    });

    it('does not record login history when the previous session is still active', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      singleMock.mockResolvedValue({
        data: { last_active_at: oneMinuteAgo },
      });

      interceptor.intercept(buildContext(request), handler);
      await flushPromises();

      expect(insertMock).not.toHaveBeenCalled();
    });

    it('takes the first value when x-forwarded-for and user-agent are arrays', async () => {
      const arrayHeaderRequest = {
        user: { id: 'user-2' },
        ip: undefined,
        headers: {
          'x-forwarded-for': ['9.9.9.9', '8.8.8.8'],
          'user-agent': ['agent-one', 'agent-two'],
        },
      };
      singleMock.mockResolvedValue({ data: null });

      interceptor.intercept(buildContext(arrayHeaderRequest), handler);
      await flushPromises();

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-2',
        ip_address: '9.9.9.9',
        user_agent: 'agent-one',
      });
    });

    it('logs a warning but still checks for a new session when the update fails', async () => {
      updateEqMock.mockResolvedValue({ error: { message: 'update failed' } });
      singleMock.mockResolvedValue({ data: null });

      interceptor.intercept(buildContext(request), handler);
      await flushPromises();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('update failed'),
      );
      expect(insertMock).toHaveBeenCalled();
    });

    it('logs a warning when recording login history fails', async () => {
      singleMock.mockResolvedValue({ data: null });
      insertMock.mockResolvedValue({ error: { message: 'insert failed' } });

      interceptor.intercept(buildContext(request), handler);
      await flushPromises();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('insert failed'),
      );
    });

    it('logs an error and does not throw when the lookup rejects unexpectedly', async () => {
      singleMock.mockRejectedValue(new Error('boom'));

      expect(() =>
        interceptor.intercept(buildContext(request), handler),
      ).not.toThrow();
      await flushPromises();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('boom'),
      );
    });
  });
});
