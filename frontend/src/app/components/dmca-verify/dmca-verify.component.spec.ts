import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DmcaService } from '../../services/dmca.service';
import { I18nService } from '../../services/i18n.service';
import { DmcaVerifyComponent } from './dmca-verify.component';

describe('DmcaVerifyComponent', () => {
  let fixture: ComponentFixture<DmcaVerifyComponent>;
  const verifyNotice = vi.fn();

  const query = (selector: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);

  async function open(token: string | undefined): Promise<void> {
    fixture = TestBed.createComponent(DmcaVerifyComponent);
    if (token !== undefined) fixture.componentRef.setInput('token', token);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [DmcaVerifyComponent],
      providers: [
        provideRouter([]),
        { provide: DmcaService, useValue: { verifyNotice } },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key, currentLang: () => 'en-GB' },
        },
      ],
    });
  });

  it('confirms the token from the link and reports each item', async () => {
    verifyNotice.mockResolvedValue([
      { reference: 'DMCA-AAAAAAAAAA', status: 'content_disabled' },
      { reference: 'DMCA-BBBBBBBBBB', status: 'needs_review' },
    ]);

    await open('T'.repeat(43));

    expect(verifyNotice).toHaveBeenCalledWith('T'.repeat(43));
    const success = query('[data-testid="dmca-verify-success"]');
    expect(success?.getAttribute('role')).toBe('status');
    expect(success?.textContent).toContain('dmca.verify.successTitle');
    expect(success?.textContent).toContain('DMCA-AAAAAAAAAA');
    expect(success?.textContent).toContain('dmca.status.content_disabled');
    expect(success?.textContent).toContain('dmca.status.needs_review');
  });

  it('shows a progress message while confirming', () => {
    verifyNotice.mockReturnValue(new Promise(() => undefined));
    fixture = TestBed.createComponent(DmcaVerifyComponent);
    fixture.componentRef.setInput('token', 'T'.repeat(43));
    fixture.detectChanges();

    expect(query('[data-testid="dmca-verify-loading"]')?.textContent).toContain('dmca.verify.loading');
    expect(query('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('explains a link that carries no token, without calling the server', async () => {
    await open(undefined);

    expect(verifyNotice).not.toHaveBeenCalled();
    expect(query('[data-testid="dmca-verify-missing"]')?.textContent).toContain(
      'dmca.verify.invalid',
    );
  });

  it.each([
    [404, 'dmca.verify.invalid'],
    [400, 'dmca.verify.invalid'],
    [410, 'dmca.verify.expired'],
  ])('explains a %i response and points to a fresh notice', async (status, key) => {
    verifyNotice.mockRejectedValue(new HttpErrorResponse({ status }));

    await open('T'.repeat(43));

    const alert = query('[data-testid="dmca-verify-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain(key);
    expect(query('[data-testid="dmca-verify-retry"]')).toBeNull();
    expect(query('a[href="/dmca"]')).not.toBeNull();
  });

  it('offers a retry only for a temporary failure', async () => {
    verifyNotice.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await open('T'.repeat(43));

    expect(query('[data-testid="dmca-verify-error"]')?.textContent).toContain('dmca.verify.error');
    verifyNotice.mockResolvedValue([{ reference: 'DMCA-AAAAAAAAAA', status: 'content_disabled' }]);
    (query('[data-testid="dmca-verify-retry"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('[data-testid="dmca-verify-success"]')).not.toBeNull();
    expect(verifyNotice).toHaveBeenCalledTimes(2);
  });
});
