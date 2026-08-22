import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AdminAuditService } from './admin-audit.service';
import { AdminMutationAuditInterceptor } from './admin-mutation-audit.interceptor';

function contextFor(
  method: string,
  baseUrl: string,
  path: string,
  user: { sub: string } | undefined = { sub: 'admin-user' },
  options: {
    body?: Record<string, unknown>;
    requestId?: string;
    params?: Record<string, string>;
    handlerName?: string;
  } = {},
): ExecutionContext {
  const handler = Object.defineProperty(function testHandler() {}, 'name', {
    value: options.handlerName ?? 'testHandler',
  });
  const controller = class TestController {};
  const request = {
    method,
    baseUrl,
    path,
    route: { path },
    params: options.params ?? { id: 'target-user' },
    headers: { 'x-request-id': options.requestId ?? 'request-123' },
    user,
    body: options.body ?? { password: 'must-never-be-audited' },
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => handler,
    getClass: () => controller,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({
      getContext: () => undefined,
      getData: () => undefined,
    }),
    switchToWs: () => ({
      getClient: () => undefined,
      getData: () => undefined,
      getPattern: () => undefined,
    }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function interceptorWithAudit() {
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const interceptor = new AdminMutationAuditInterceptor(
    new Reflector(),
    audit as unknown as AdminAuditService,
  );
  return { interceptor, audit };
}

describe('AdminMutationAuditInterceptor', () => {
  it('audits privileged reads and records only bounded result metadata', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = {
      handle: () =>
        of({ users: [{ id: 'one' }, { id: 'two' }], secret: 'never-copy-me' }),
    };

    const result = await firstValueFrom(
      interceptor.intercept(contextFor('GET', '/api/admin', '/users'), next),
    );

    expect(result).toMatchObject({ users: expect.any(Array) });
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        action: 'get /api/admin/users',
        targetId: 'target-user',
        targetType: 'user',
        outcome: 'success',
        correlationId: 'request-123',
        metadata: expect.objectContaining({
          source: 'admin-request-interceptor',
          resultCount: 2,
        }),
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain(
      'never-copy-me',
    );
  });

  it('does not duplicate reads that already have richer route-level audits', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = { handle: () => of({ events: [] }) };

    await firstValueFrom(
      interceptor.intercept(
        contextFor('GET', '/api/admin/v1', '/audit', { sub: 'admin-user' }),
        next,
      ),
    );

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not audit non-admin requests', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(
      interceptor.intercept(contextFor('POST', '/api/profile', '/me'), next),
    );

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('persists a bounded success audit before completing an admin mutation', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    const result = await firstValueFrom(
      interceptor.intercept(
        contextFor('POST', '/api/admin', '/users/:id/ban', {
          sub: 'admin-user',
        }),
        next,
      ),
    );

    expect(result).toEqual({ ok: true });
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-user',
        targetId: 'target-user',
        targetType: 'user',
        outcome: 'success',
        correlationId: 'request-123',
      }),
    );
    const recorded = audit.record.mock.calls[0][0];
    expect(JSON.stringify(recorded)).not.toContain('must-never-be-audited');
  });

  it('captures an allow-listed reason without copying the request body', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(
      interceptor.intercept(
        contextFor(
          'POST',
          '/api/admin',
          '/users/:id/ban',
          { sub: 'admin-user' },
          {
            body: {
              reasonCode: 'fraud_or_abuse',
              operatorNote: 'Repeated automated abuse confirmed by review.',
              token: 'never-copy-this',
            },
          },
        ),
        next,
      ),
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: 'fraud_or_abuse',
        operatorNote: 'Repeated automated abuse confirmed by review.',
      }),
    );
    expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain(
      'never-copy-this',
    );
  });

  it('drops an untrusted request ID rather than persisting arbitrary header data', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(
      interceptor.intercept(
        contextFor('GET', '/api/admin', '/users', { sub: 'admin-user' }, {
          requestId: 'Bearer secret-token-value',
        }),
        next,
      ),
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: undefined }),
    );
  });

  it('persists a failed audit and preserves the original operation error', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const failure = new Error('operation failed');
    const next: CallHandler = { handle: () => throwError(() => failure) };

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor('DELETE', '/api/admin', '/blocks/:blockId', {
            sub: 'admin-user',
          }),
          next,
        ),
      ),
    ).rejects.toThrow('operation failed');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failed',
        correlationId: 'request-123',
      }),
    );
  });
});
