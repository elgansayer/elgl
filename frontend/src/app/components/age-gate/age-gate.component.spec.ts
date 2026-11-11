import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgeGateService, AgeGateView } from '../../services/age-gate.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { AgeGateComponent, toIsoDate } from './age-gate.component';

const REQUIRED: AgeGateView = { status: 'required', required: true, blocked: false };
const PASSED: AgeGateView = { status: 'passed', required: false, blocked: false };
const BLOCKED: AgeGateView = { status: 'blocked_under_age', required: false, blocked: true };

describe('toIsoDate', () => {
  const now = new Date('2026-11-11T10:00:00.000Z');

  it('builds an ISO calendar date from the typed parts', () => {
    expect(toIsoDate({ day: '5', month: '3', year: '1999' }, now)).toBe('1999-03-05');
    expect(toIsoDate({ day: '29', month: '02', year: '2004' }, now)).toBe('2004-02-29');
  });

  it.each([
    { day: '', month: '3', year: '1999' },
    { day: '31', month: '2', year: '1999' },
    { day: '29', month: '2', year: '2003' },
    { day: '0', month: '3', year: '1999' },
    { day: '5', month: '13', year: '1999' },
    { day: '5', month: '3', year: '99' },
    { day: '5', month: '3', year: '1899' },
    { day: '12', month: '11', year: '2026' },
    { day: 'ab', month: '3', year: '1999' },
    { day: '5', month: '3', year: '1999x' },
  ])('rejects %j', (parts) => {
    expect(toIsoDate(parts, now)).toBeNull();
  });

  it('accepts today but not tomorrow', () => {
    expect(toIsoDate({ day: '11', month: '11', year: '2026' }, now)).toBe('2026-11-11');
    expect(toIsoDate({ day: '12', month: '11', year: '2026' }, now)).toBeNull();
  });
});

describe('AgeGateComponent', () => {
  let fixture: ComponentFixture<AgeGateComponent>;
  const loadStatus = vi.fn();
  const submit = vi.fn();
  const signOut = vi.fn();
  const navigateByUrl = vi.fn();

  async function create(initial: AgeGateView | { failure: unknown }): Promise<void> {
    if ('failure' in initial) {
      loadStatus.mockRejectedValue(initial.failure);
    } else {
      loadStatus.mockResolvedValue(initial);
    }
    fixture = TestBed.createComponent(AgeGateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement;
  const query = (selector: string): HTMLElement | null => root().querySelector(selector);

  async function fillAndSubmit(day: string, month: string, year: string): Promise<void> {
    const set = (id: string, value: string) => {
      const input = query(`#${id}`);
      if (!(input instanceof HTMLInputElement)) throw new Error(`missing ${id}`);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('age-gate-day', day);
    set('age-gate-month', month);
    set('age-gate-year', year);
    query('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
    navigateByUrl.mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [AgeGateComponent],
      providers: [
        { provide: AgeGateService, useValue: { loadStatus, submit } },
        { provide: AuthService, useValue: { signOut } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key, currentLang: () => 'en-GB' },
        },
      ],
    });
  });

  it('asks for a date of birth with labelled, autofill-aware fields', async () => {
    await create(REQUIRED);

    expect(query('h1')?.textContent).toContain('ageGate.title');
    expect(query('form')).not.toBeNull();
    for (const [id, autocomplete] of [
      ['age-gate-day', 'bday-day'],
      ['age-gate-month', 'bday-month'],
      ['age-gate-year', 'bday-year'],
    ]) {
      const input = query(`#${id}`);
      expect(input?.getAttribute('autocomplete')).toBe(autocomplete);
      expect(input?.getAttribute('inputmode')).toBe('numeric');
      expect(query(`label[for="${id}"]`)).not.toBeNull();
    }
    expect(query('fieldset legend')?.textContent).toContain('ageGate.legend');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('never states which age passes', async () => {
    await create(REQUIRED);

    const visible = root().textContent ?? '';
    expect(visible).not.toMatch(/\b1[0-9]\b/);
    expect(visible.toLowerCase()).not.toContain('years');
    expect(visible.toLowerCase()).not.toContain('minimum');
  });

  it('shows a loading state while the status is fetched', () => {
    loadStatus.mockReturnValue(new Promise(() => undefined));
    fixture = TestBed.createComponent(AgeGateComponent);
    fixture.detectChanges();

    expect(query('[data-testid="age-gate-loading"]')?.textContent).toContain('ageGate.loading');
    expect(query('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('refuses an impossible date locally without calling the server', async () => {
    await create(REQUIRED);

    await fillAndSubmit('31', '2', '1999');

    expect(submit).not.toHaveBeenCalled();
    const alert = query('[data-testid="age-gate-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('ageGate.invalidDate');
    expect(query('#age-gate-day')?.getAttribute('aria-invalid')).toBe('true');
    expect(query('#age-gate-day')?.getAttribute('aria-describedby')).toBe('age-gate-error');
  });

  it('sends the ISO date and leaves the screen once the account is cleared', async () => {
    submit.mockResolvedValue(PASSED);
    await create(REQUIRED);

    await fillAndSubmit('23', '4', '1990');

    expect(submit).toHaveBeenCalledWith('1990-04-23');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('closes the session and shows a neutral message when the account is blocked', async () => {
    submit.mockResolvedValue(BLOCKED);
    await create(REQUIRED);

    await fillAndSubmit('4', '3', '2018');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(query('form')).toBeNull();
    expect(query('[data-testid="age-gate-blocked"]')?.textContent).toContain(
      'ageGate.blockedMessage',
    );
    expect(query('h1')?.textContent).toContain('ageGate.blockedTitle');
    expect(root().textContent).not.toContain('2018');
    expect(navigateByUrl).not.toHaveBeenCalledWith('/');
  });

  it('shows the blocked screen straight away for an account that was blocked earlier', async () => {
    await create(BLOCKED);

    expect(query('form')).toBeNull();
    expect(query('[data-testid="age-gate-blocked"]')).not.toBeNull();
    expect(signOut).not.toHaveBeenCalled();

    (query('[data-testid="age-gate-sign-out"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it('sends an already cleared account on its way', async () => {
    await create(PASSED);
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('treats a grandfathered account that is not yet required as cleared', async () => {
    await create({ status: 'legacy', required: false, blocked: false });
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('asks the user to retry when the server rejects the date', async () => {
    submit.mockRejectedValue(
      new HttpErrorResponse({ status: 400, error: { code: 'INVALID_DATE_OF_BIRTH' } }),
    );
    await create(REQUIRED);
    await fillAndSubmit('23', '4', '1990');

    expect(query('[data-testid="age-gate-error"]')?.textContent).toContain('ageGate.invalidDate');
    expect(query('form')).not.toBeNull();
  });

  it('reports other failures without losing what was typed', async () => {
    submit.mockRejectedValue(new HttpErrorResponse({ status: 503 }));
    await create(REQUIRED);
    await fillAndSubmit('23', '4', '1990');

    expect(query('[data-testid="age-gate-error"]')?.textContent).toContain('ageGate.serverError');
    expect((query('#age-gate-year') as HTMLInputElement).value).toBe('1990');
    expect(query('[data-testid="age-gate-submit"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('does not submit twice while a request is in flight', async () => {
    let resolveSubmit: (view: AgeGateView) => void = () => undefined;
    submit.mockReturnValue(
      new Promise<AgeGateView>((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    await create(REQUIRED);

    await fillAndSubmit('23', '4', '1990');
    query('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(query('[data-testid="age-gate-submit"]')?.hasAttribute('disabled')).toBe(true);
    expect(query('[data-testid="age-gate-submit"]')?.textContent).toContain('ageGate.submitting');

    resolveSubmit(PASSED);
    await fixture.whenStable();
  });

  it('offers a retry when the status cannot be loaded', async () => {
    await create({ failure: new HttpErrorResponse({ status: 503 }) });

    expect(query('[data-testid="age-gate-load-error"]')?.getAttribute('role')).toBe('alert');
    loadStatus.mockResolvedValue(REQUIRED);
    (query('[data-testid="age-gate-retry"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('form')).not.toBeNull();
  });
});
