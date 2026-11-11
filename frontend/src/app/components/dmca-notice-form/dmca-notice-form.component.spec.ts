import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DmcaService } from '../../services/dmca.service';
import { I18nService } from '../../services/i18n.service';
import {
  DmcaNoticeFormComponent,
  MAX_MATERIAL_REFERENCES,
  parseMaterialReferences,
} from './dmca-notice-form.component';

describe('parseMaterialReferences', () => {
  it('keeps one trimmed entry per non-blank line without repeats', () => {
    expect(parseMaterialReferences(' a \r\n\n b\na\n   \nc ')).toEqual(['a', 'b', 'c']);
  });

  it('returns nothing for blank input', () => {
    expect(parseMaterialReferences('  \n \r\n')).toEqual([]);
  });
});

describe('DmcaNoticeFormComponent', () => {
  let fixture: ComponentFixture<DmcaNoticeFormComponent>;
  const submitNotice = vi.fn();

  const root = (): HTMLElement => fixture.nativeElement;
  const query = (selector: string): HTMLElement | null => root().querySelector(selector);

  function type(id: string, value: string): void {
    const field = query(`#${id}`);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
      throw new Error(`missing field ${id}`);
    }
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  function tick(id: string): void {
    const box = query(`#${id}`);
    if (!box) throw new Error(`missing checkbox ${id}`);
    box.click();
  }

  async function submit(): Promise<void> {
    query('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fillValidNotice(): void {
    type('dmca-name', '  Ana Costa ');
    type('dmca-email', 'ana@example.com');
    type('dmca-work', 'The song "Mar" released in 2019');
    type('dmca-material', '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d\nhttps://cdn.example.com/a.jpg');
    type('dmca-signature', 'Ana Costa');
    tick('dmca-good-faith');
    tick('dmca-accuracy');
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [DmcaNoticeFormComponent],
      providers: [
        provideRouter([]),
        { provide: DmcaService, useValue: { submitNotice } },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key, currentLang: () => 'en-GB' },
        },
      ],
    });
    fixture = TestBed.createComponent(DmcaNoticeFormComponent);
    fixture.detectChanges();
  });

  it('presents a labelled form with a link to the policy', () => {
    expect(query('h1')?.textContent).toContain('dmca.form.title');
    expect(query('a[href="/legal/dmca"]')).not.toBeNull();
    for (const id of [
      'dmca-name',
      'dmca-email',
      'dmca-organisation',
      'dmca-address',
      'dmca-phone',
      'dmca-work',
      'dmca-material',
      'dmca-signature',
      'dmca-good-faith',
      'dmca-accuracy',
    ]) {
      expect(query(`label[for="${id}"]`), `label for ${id}`).not.toBeNull();
    }
    expect(query('#dmca-email')?.getAttribute('autocomplete')).toBe('email');
    expect(query('#dmca-work')?.getAttribute('aria-describedby')).toBe('dmca-work-hint');
    expect(root().textContent).toContain('dmca.form.sharing');
  });

  it('does not send an incomplete notice', async () => {
    await submit();

    expect(submitNotice).not.toHaveBeenCalled();
    const alert = query('[data-testid="dmca-form-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('dmca.form.required');
    expect(query('#dmca-name')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('requires both statutory statements to be accepted', async () => {
    fillValidNotice();
    tick('dmca-accuracy');
    fixture.detectChanges();

    await submit();

    expect(submitNotice).not.toHaveBeenCalled();
  });

  it('sends trimmed values, one reference per line, and omits blank optional fields', async () => {
    submitNotice.mockResolvedValue({ references: ['DMCA-AAAAAAAAAA', 'DMCA-BBBBBBBBBB'] });
    fillValidNotice();

    await submit();

    expect(submitNotice).toHaveBeenCalledWith({
      claimantName: 'Ana Costa',
      claimantEmail: 'ana@example.com',
      claimantOrganisation: undefined,
      claimantAddress: undefined,
      claimantPhone: undefined,
      copyrightedWork: 'The song "Mar" released in 2019',
      materialReferences: [
        '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
        'https://cdn.example.com/a.jpg',
      ],
      goodFaithStatement: true,
      accuracyStatement: true,
      electronicSignature: 'Ana Costa',
    });
  });

  it('replaces the form with the references and the next step once the notice is accepted', async () => {
    submitNotice.mockResolvedValue({ references: ['DMCA-AAAAAAAAAA', 'DMCA-BBBBBBBBBB'] });
    fillValidNotice();

    await submit();

    expect(query('form')).toBeNull();
    const success = query('[data-testid="dmca-form-success"]');
    expect(success?.getAttribute('role')).toBe('status');
    expect(success?.textContent).toContain('dmca.form.successMessage');
    expect(Array.from(success?.querySelectorAll('li') ?? []).map((li) => li.textContent)).toEqual([
      'DMCA-AAAAAAAAAA',
      'DMCA-BBBBBBBBBB',
    ]);
  });

  it('refuses more items than one notice may carry', async () => {
    fillValidNotice();
    type(
      'dmca-material',
      Array.from({ length: MAX_MATERIAL_REFERENCES + 1 }, (_, index) => `item-${index}`).join('\n'),
    );

    await submit();

    expect(submitNotice).not.toHaveBeenCalled();
    expect(query('[data-testid="dmca-form-error"]')?.textContent).toContain(
      'dmca.form.tooManyReferences',
    );
  });

  it.each([
    [429, 'dmca.form.rateLimited'],
    [400, 'dmca.form.required'],
    [503, 'dmca.form.error'],
  ])('explains a %i response and keeps the form for another attempt', async (status, key) => {
    submitNotice.mockRejectedValue(new HttpErrorResponse({ status }));
    fillValidNotice();

    await submit();

    expect(query('[data-testid="dmca-form-error"]')?.textContent).toContain(key);
    expect(query('form')).not.toBeNull();
    expect((query('#dmca-name') as HTMLInputElement).value).toBe('  Ana Costa ');
    expect(query('[data-testid="dmca-form-submit"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('blocks a second submission while one is in flight', async () => {
    let resolveSubmit: (value: { references: string[] }) => void = () => undefined;
    submitNotice.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    fillValidNotice();

    await submit();
    await submit();

    expect(submitNotice).toHaveBeenCalledTimes(1);
    expect(query('[data-testid="dmca-form-submit"]')?.hasAttribute('disabled')).toBe(true);
    resolveSubmit({ references: ['DMCA-AAAAAAAAAA'] });
    await fixture.whenStable();
  });
});
