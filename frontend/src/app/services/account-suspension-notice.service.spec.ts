import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_SUSPENDED_CODE,
  AccountSuspensionNoticeService,
} from './account-suspension-notice.service';
import { I18nService } from './i18n.service';
import { toastsSignal } from './toast.service';

describe('AccountSuspensionNoticeService', () => {
  let service: AccountSuspensionNoticeService;
  const translate = vi.fn((key: string, params?: Record<string, string>) =>
    params ? `${key}:${params['date']}` : key,
  );
  const body = {
    statusCode: 403,
    code: ACCOUNT_SUSPENDED_CODE,
    suspendedUntil: '2026-12-01T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    toastsSignal.set([]);
    translate.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: I18nService, useValue: { translate } }] });
    service = TestBed.inject(AccountSuspensionNoticeService);
  });

  afterEach(() => {
    vi.useRealTimers();
    toastsSignal.set([]);
  });

  it('explains the suspension once with the end time and records it', () => {
    service.handle(body);

    expect(toastsSignal()).toHaveLength(1);
    expect(toastsSignal()[0].type).toBe('error');
    expect(toastsSignal()[0].message).toMatch(/^account\.suspendedUntil:/);
    expect(service.suspendedUntil()).toEqual(new Date('2026-12-01T12:00:00.000Z'));
  });

  it('does not repeat the toast for the burst of requests a page load makes', () => {
    service.handle(body);
    service.handle(body);
    service.handle(body);

    expect(toastsSignal()).toHaveLength(1);

    vi.advanceTimersByTime(31_000);
    service.handle(body);

    expect(toastsSignal().filter((toast) => toast.message.startsWith('account.'))).toHaveLength(1);
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('falls back to the plain message when no valid end time is supplied', () => {
    service.handle({ code: ACCOUNT_SUSPENDED_CODE, suspendedUntil: 'someday' });

    expect(toastsSignal()[0].message).toBe('account.suspended');
    expect(service.suspendedUntil()).toBeNull();
  });

  it.each([null, undefined, 'text', 403, {}, { code: 'FORBIDDEN' }])(
    'ignores a 403 body that is not the suspension contract: %j',
    (ignored) => {
      service.handle(ignored);

      expect(toastsSignal()).toHaveLength(0);
      expect(service.suspendedUntil()).toBeNull();
    },
  );
});
