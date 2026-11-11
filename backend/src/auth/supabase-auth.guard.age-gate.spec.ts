import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AgeGateExempt } from '../age-gate/age-gate-exempt.decorator';
import { AgeGateStatusService } from '../age-gate/age-gate-status.service';
import { AGE_GATE_ERROR_CODES } from '../age-gate/age-gate.constants';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthModule } from './auth.module';
import { SupabaseAuthGuard } from './supabase-auth.guard';

class GatedController {
  list(): void {}
}

class OpenHandlerController {
  @AgeGateExempt()
  exempt(): void {}
}

@AgeGateExempt()
class ExemptController {
  anything(): void {}
}

describe('SupabaseAuthGuard age gate', () => {
  const getUser = vi.fn();
  const evaluate = vi.fn();
  const authenticatedUser = { id: 'user-1', email: 'person@example.com' };

  function contextFor(
    type: 'http' | 'ws',
    target: { controller: new () => unknown; handler: string },
  ) {
    const request =
      type === 'http'
        ? { headers: { authorization: 'Bearer good-token' } }
        : { handshake: { headers: { authorization: 'Bearer good-token' } } };
    const instance = target.controller.prototype as Record<string, () => void>;
    const context = {
      getType: () => type,
      getHandler: () => instance[target.handler],
      getClass: () => target.controller,
      switchToHttp: () => ({ getRequest: () => request }),
      switchToWs: () => ({ getClient: () => request }),
    } as unknown as ExecutionContext;
    return { context, request: request as Record<string, unknown> };
  }

  const gated = { controller: GatedController, handler: 'list' };

  function buildGuard(options: { withReflector?: boolean } = {}) {
    return new SupabaseAuthGuard(
      {
        getClient: () => ({ auth: { getUser } }),
      } as unknown as SupabaseService,
      { evaluate } as unknown as AgeGateStatusService,
      options.withReflector === false ? undefined : new Reflector(),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: authenticatedUser },
      error: null,
    });
    evaluate.mockResolvedValue({ allowed: true });
  });

  it('lets an account that passed the gate through and attaches the user', async () => {
    const { context, request } = contextFor('http', gated);

    await expect(buildGuard().canActivate(context)).resolves.toBe(true);

    expect(evaluate).toHaveBeenCalledWith('user-1');
    expect(request.user).toEqual(authenticatedUser);
  });

  it('refuses an account that must still declare a date of birth', async () => {
    evaluate.mockResolvedValue({
      allowed: false,
      code: AGE_GATE_ERROR_CODES.required,
    });
    const { context, request } = contextFor('http', gated);

    const attempt = buildGuard().canActivate(context);

    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({
      response: { statusCode: 403, code: 'AGE_GATE_REQUIRED' },
    });
    // The handler never runs, but the identity stays available to filters.
    expect(request.user).toEqual(authenticatedUser);
  });

  it('refuses a blocked account with a distinct code and a neutral message', async () => {
    evaluate.mockResolvedValue({
      allowed: false,
      code: AGE_GATE_ERROR_CODES.blocked,
    });
    const { context } = contextFor('http', gated);

    const attempt = buildGuard().canActivate(context);

    await expect(attempt).rejects.toMatchObject({
      response: {
        statusCode: 403,
        code: 'AGE_GATE_BLOCKED',
        message: 'This account is not eligible to use the service',
      },
    });
  });

  it('enforces the gate for websocket handshakes too', async () => {
    evaluate.mockResolvedValue({
      allowed: false,
      code: AGE_GATE_ERROR_CODES.required,
    });
    const { context } = contextFor('ws', gated);

    await expect(buildGuard().canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    ['a handler', { controller: OpenHandlerController, handler: 'exempt' }],
    ['a controller', { controller: ExemptController, handler: 'anything' }],
  ])('skips the check for an exempt %s', async (_label, target) => {
    evaluate.mockResolvedValue({
      allowed: false,
      code: AGE_GATE_ERROR_CODES.blocked,
    });
    const { context } = contextFor('http', target);

    await expect(buildGuard().canActivate(context)).resolves.toBe(true);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('fails closed when the reflector is unavailable', async () => {
    evaluate.mockResolvedValue({
      allowed: false,
      code: AGE_GATE_ERROR_CODES.required,
    });
    const { context } = contextFor('http', {
      controller: ExemptController,
      handler: 'anything',
    });

    await expect(
      buildGuard({ withReflector: false }).canActivate(context),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('propagates an unavailable status lookup instead of admitting the request', async () => {
    evaluate.mockRejectedValue(new ServiceUnavailableException());
    const { context } = contextFor('http', gated);

    await expect(buildGuard().canActivate(context)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('never consults the age gate for unauthenticated requests', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad' },
    });
    const { context } = contextFor('http', gated);

    await expect(buildGuard().canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('keeps legacy behaviour where no age-gate service is provided', async () => {
    const guard = new SupabaseAuthGuard({
      getClient: () => ({ auth: { getUser } }),
    } as unknown as SupabaseService);
    const { context } = contextFor('http', gated);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  describe('dependency injection wiring', () => {
    it('hands the real status service to the guard when a module provides it', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          SupabaseAuthGuard,
          AgeGateStatusService,
          { provide: SupabaseService, useValue: { getClient: () => ({}) } },
          { provide: ConfigService, useValue: { get: () => undefined } },
        ],
      }).compile();

      const guard = moduleRef.get(SupabaseAuthGuard);
      const injected = (guard as unknown as { ageGateStatus?: unknown })
        .ageGateStatus;
      expect(injected).toBeInstanceOf(AgeGateStatusService);
      expect(
        (guard as unknown as { reflector?: unknown }).reflector,
      ).toBeInstanceOf(Reflector);
    });

    it('registers and exports the status service from the global AuthModule', () => {
      const providers = Reflect.getMetadata(
        'providers',
        AuthModule,
      ) as unknown[];
      const exports = Reflect.getMetadata('exports', AuthModule) as unknown[];

      expect(providers).toContain(AgeGateStatusService);
      expect(exports).toContain(AgeGateStatusService);
    });
  });
});
