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
): ExecutionContext {
  const handler = function testHandler() {};
  const controller = class TestController {};
  const request = {
    method,
    baseUrl,
    path,
    route: { path },
    params: { id: 'target-user' },
    headers: { 'x-request-id': 'request-123' },
    user,
    body: { password: 'must-never-be-audited' },
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
  it('does not audit safe admin reads', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(
      interceptor.intercept(contextFor('GET', '/api/admin', '/users'), next),
    );

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not audit non-admin mutations', async () => {
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
        contextFor('POST', '/api/admin', '/users/:id/ban'),
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

  it('persists a failed audit and preserves the original mutation error', async () => {
    const { interceptor, audit } = interceptorWithAudit();
    const failure = new Error('mutation failed');
    const next: CallHandler = { handle: () => throwError(() => failure) };

    await expect(
      firstValueFrom(
        interceptor.intercept(
          contextFor('DELETE', '/api/admin', '/blocks/:blockId'),
          next,
        ),
      ),
    ).rejects.toThrow('mutation failed');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failed',
        correlationId: 'request-123',
      }),
    );
  });
});
