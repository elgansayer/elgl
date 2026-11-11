import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DmcaService, OwnerNotice } from '../../services/dmca.service';
import { I18nService } from '../../services/i18n.service';
import { CopyrightNoticesComponent } from './copyright-notices.component';

const notice = (overrides: Partial<OwnerNotice> = {}): OwnerNotice => ({
  id: 'n1',
  reference: 'DMCA-AAAAAAAAAA',
  status: 'content_disabled',
  claimantName: 'Ana Costa',
  claimantOrganisation: 'Costa Music',
  copyrightedWork: 'The song "Mar"',
  contentDisabledAt: '2026-11-11T10:00:00.000Z',
  counterNoticeAt: null,
  restoreAfter: null,
  canCounterNotice: true,
  ...overrides,
});

describe('CopyrightNoticesComponent', () => {
  let fixture: ComponentFixture<CopyrightNoticesComponent>;
  const listMine = vi.fn();
  const fileCounterNotice = vi.fn();

  const root = (): HTMLElement => fixture.nativeElement;
  const query = (selector: string): HTMLElement | null => root().querySelector(selector);

  async function open(): Promise<void> {
    fixture = TestBed.createComponent(CopyrightNoticesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(id: string, value: string): void {
    const field = query(`#${id}`);
    if (!(field instanceof HTMLInputElement)) throw new Error(`missing field ${id}`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  async function submitCounter(): Promise<void> {
    query('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function completeCounter(): void {
    type('cn-name-n1', 'Sam Lee');
    type('cn-address-n1', '1 Road, Town');
    type('cn-signature-n1', 'Sam Lee');
    query('#cn-good-faith-n1')?.click();
    query('#cn-jurisdiction-n1')?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [CopyrightNoticesComponent],
      providers: [
        { provide: DmcaService, useValue: { listMine, fileCounterNotice } },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key, currentLang: () => 'en-GB' },
        },
      ],
    });
  });

  it('shows a helpful empty state', async () => {
    listMine.mockResolvedValue([]);
    await open();

    expect(query('[data-testid="copyright-empty"]')?.textContent).toContain('dmca.owner.empty');
  });

  it('lists each notice with its status and details', async () => {
    listMine.mockResolvedValue([
      notice(),
      notice({
        id: 'n2',
        reference: 'DMCA-BBBBBBBBBB',
        status: 'counter_notice_received',
        canCounterNotice: false,
        restoreAfter: '2026-11-25T10:00:00.000Z',
      }),
    ]);
    await open();

    const first = query('[data-testid="copyright-notice-DMCA-AAAAAAAAAA"]');
    expect(first?.textContent).toContain('dmca.status.content_disabled');
    expect(first?.textContent).toContain('Ana Costa');
    expect(first?.textContent).toContain('Costa Music');
    expect(first?.textContent).toContain('The song "Mar"');

    const second = query('[data-testid="copyright-notice-DMCA-BBBBBBBBBB"]');
    expect(second?.textContent).toContain('dmca.status.counter_notice_received');
    expect(second?.textContent).toContain('dmca.owner.restoreOn');
    // Only a notice that still accepts one offers the response form.
    expect(second?.querySelector('[data-testid="counter-notice-open"]')).toBeNull();
    expect(first?.querySelector('[data-testid="counter-notice-open"]')).not.toBeNull();
  });

  it('reports a load failure and can try again', async () => {
    listMine.mockRejectedValueOnce(new HttpErrorResponse({ status: 503 }));
    await open();

    expect(query('[data-testid="copyright-error"]')?.getAttribute('role')).toBe('alert');
    listMine.mockResolvedValue([]);
    (query('[data-testid="copyright-error"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('[data-testid="copyright-empty"]')).not.toBeNull();
  });

  describe('counter-notification', () => {
    beforeEach(async () => {
      listMine.mockResolvedValue([notice()]);
      await open();
      (query('[data-testid="counter-notice-open"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    });

    it('opens a labelled form with the statutory statements', () => {
      expect(query('form')).not.toBeNull();
      for (const id of [
        'cn-name-n1',
        'cn-address-n1',
        'cn-phone-n1',
        'cn-good-faith-n1',
        'cn-jurisdiction-n1',
        'cn-signature-n1',
      ]) {
        expect(query(`label[for="${id}"]`), `label for ${id}`).not.toBeNull();
      }
      expect(root().textContent).toContain('dmca.owner.counterIntro');
    });

    it('will not send until every statement is accepted', async () => {
      type('cn-name-n1', 'Sam Lee');

      await submitCounter();

      expect(fileCounterNotice).not.toHaveBeenCalled();
      expect(query('[data-testid="counter-notice-error"]')?.textContent).toContain(
        'dmca.owner.required',
      );
    });

    it('sends the counter-notification, confirms it and refreshes the list', async () => {
      fileCounterNotice.mockResolvedValue(
        notice({ status: 'counter_notice_received', canCounterNotice: false }),
      );
      completeCounter();
      listMine.mockResolvedValue([
        notice({ status: 'counter_notice_received', canCounterNotice: false }),
      ]);

      await submitCounter();

      expect(fileCounterNotice).toHaveBeenCalledWith('n1', {
        fullName: 'Sam Lee',
        address: '1 Road, Town',
        phone: undefined,
        goodFaithStatement: true,
        jurisdictionConsent: true,
        electronicSignature: 'Sam Lee',
      });
      expect(query('[data-testid="counter-notice-success"]')?.getAttribute('role')).toBe('status');
      expect(query('form')).toBeNull();
      expect(listMine).toHaveBeenCalledTimes(2);
    });

    it.each([
      [409, 'dmca.owner.unavailable'],
      [404, 'dmca.owner.unavailable'],
      [400, 'dmca.owner.required'],
      [503, 'dmca.owner.error'],
    ])('explains a %i response and keeps the form', async (status, key) => {
      fileCounterNotice.mockRejectedValue(new HttpErrorResponse({ status }));
      completeCounter();

      await submitCounter();

      expect(query('[data-testid="counter-notice-error"]')?.textContent).toContain(key);
      expect(query('form')).not.toBeNull();
    });

    it('can be dismissed without sending anything', () => {
      const cancel = Array.from(root().querySelectorAll('button')).find((button) =>
        button.textContent?.includes('dmca.owner.cancel'),
      );
      cancel?.click();
      fixture.detectChanges();

      expect(query('form')).toBeNull();
      expect(fileCounterNotice).not.toHaveBeenCalled();
    });
  });
});
