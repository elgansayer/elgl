import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MetricsService } from '../metrics/metrics.service';
import {
  ALLOW_OUTDATED_CLIENT_KEY,
  CLIENT_UPGRADE_REQUIRED_CODE,
  ClientVersionEnforcementMode,
} from './client-version.constants';
import { ClientVersionGuard } from './client-version.guard';
import { VersionService } from './version.service';

describe('ClientVersionGuard', () => {
  const handler = () => undefined;
  class TestController {}

  let setHeader: ReturnType<typeof vi.fn>;
  let recordClientVersionCheck: ReturnType<typeof vi.fn>;
  let allowOutdated: boolean | undefined;
  let mode: ClientVersionEnforcementMode;
  let versions: VersionService;
  let guard: ClientVersionGuard;

  const context = (
    headers: Record<string, string | string[] | undefined>,
    type = 'http',
  ): ExecutionContext =>
    ({
      getType: () => type,
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => ({ setHeader }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    process.env.MINIMUM_SUPPORTED_APP_VERSION = '2.0.0';
    delete process.env.CLIENT_VERSION_ENFORCEMENT;
    setHeader = vi.fn();
    recordClientVersionCheck = vi.fn();
    allowOutdated = undefined;
    mode = 'enforce';

    versions = new VersionService();
    vi.spyOn(versions, 'getEnforcementMode').mockImplementation(() => mode);

    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === ALLOW_OUTDATED_CLIENT_KEY ? allowOutdated : undefined,
      ),
    } as unknown as Reflector;
    const metrics = { recordClientVersionCheck } as unknown as MetricsService;

    guard = new ClientVersionGuard(reflector, versions, metrics);
  });

  afterEach(() => {
    delete process.env.MINIMUM_SUPPORTED_APP_VERSION;
    vi.restoreAllMocks();
  });

  it('rejects a client below the minimum with a 426 policy body', () => {
    let thrown: unknown;
    try {
      guard.canActivate(context({ 'x-app-version': '1.9.9' }));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    const exception = thrown as HttpException;
    expect(exception.getStatus()).toBe(426);
    expect(exception.getResponse()).toEqual({
      statusCode: 426,
      error: 'Upgrade Required',
      code: CLIENT_UPGRADE_REQUIRED_CODE,
      message:
        'This version of the app is no longer supported. Update to continue.',
      minimumSupported: '2.0.0',
    });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(recordClientVersionCheck).toHaveBeenCalledWith('upgrade_required');
  });

  it('does not echo the client-controlled version back in the rejection', () => {
    try {
      guard.canActivate(context({ 'x-app-version': '1.0.0-attacker' }));
    } catch (error) {
      expect(
        JSON.stringify((error as HttpException).getResponse()),
      ).not.toContain('attacker');
    }
    expect.assertions(1);
  });

  it.each(['2.0.0', '2.0.1', 'v3.1.0', '2.1.0-rc.1+build.7'])(
    'allows supported version %s',
    (version) => {
      expect(guard.canActivate(context({ 'x-app-version': version }))).toBe(
        true,
      );
      expect(recordClientVersionCheck).toHaveBeenCalledWith('supported');
      expect(setHeader).not.toHaveBeenCalled();
    },
  );

  it('treats a prerelease of the minimum as older than the minimum', () => {
    expect(() =>
      guard.canActivate(context({ 'x-app-version': '2.0.0-rc.1' })),
    ).toThrow(HttpException);
  });

  it('fails open when the header is missing', () => {
    expect(guard.canActivate(context({}))).toBe(true);
    expect(recordClientVersionCheck).toHaveBeenCalledWith('missing');
  });

  it('fails open when the header is blank', () => {
    expect(guard.canActivate(context({ 'x-app-version': '   ' }))).toBe(true);
    expect(recordClientVersionCheck).toHaveBeenCalledWith('missing');
  });

  it('fails open when the header is not a semantic version', () => {
    expect(guard.canActivate(context({ 'x-app-version': 'banana' }))).toBe(
      true,
    );
    expect(recordClientVersionCheck).toHaveBeenCalledWith('invalid');
  });

  it('evaluates only the first value of a repeated header', () => {
    expect(() =>
      guard.canActivate(context({ 'x-app-version': ['1.0.0', '9.9.9'] })),
    ).toThrow(HttpException);
  });

  it('lets routes marked AllowOutdatedClient through without any check', () => {
    allowOutdated = true;

    expect(guard.canActivate(context({ 'x-app-version': '0.1.0' }))).toBe(true);
    expect(recordClientVersionCheck).not.toHaveBeenCalled();
  });

  it('only reports in report-only mode', () => {
    mode = 'report-only';

    expect(guard.canActivate(context({ 'x-app-version': '1.0.0' }))).toBe(true);
    expect(recordClientVersionCheck).toHaveBeenCalledWith('report_only');
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('skips every check when enforcement is off', () => {
    mode = 'off';

    expect(guard.canActivate(context({ 'x-app-version': '1.0.0' }))).toBe(true);
    expect(recordClientVersionCheck).not.toHaveBeenCalled();
  });

  it('ignores non-HTTP execution contexts', () => {
    expect(guard.canActivate(context({ 'x-app-version': '1.0.0' }, 'ws'))).toBe(
      true,
    );
    expect(recordClientVersionCheck).not.toHaveBeenCalled();
  });
});
