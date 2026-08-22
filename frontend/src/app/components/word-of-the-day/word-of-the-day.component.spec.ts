import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { WordOfTheDayComponent } from './word-of-the-day.component';

describe('WordOfTheDayComponent', () => {
  let fixture: ComponentFixture<WordOfTheDayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordOfTheDayComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.unstubAllGlobals();
  });

  async function render(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(WordOfTheDayComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the API response without requiring an auth token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        word: 'こんにちは',
        translation: 'hello',
        language: 'Japanese',
        languageCode: 'ja',
        example: 'こんにちは。お元気ですか。',
        date: '2026-08-22',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const element = await render();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toBeUndefined();
    expect(element.textContent).toContain('こんにちは');
    expect(element.textContent).toContain('Japanese');
    expect(element.textContent).toContain('こんにちは。お元気ですか。');
  });

  it('shows an accessible retry state instead of fabricated vocabulary when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const element = await render();
    const alert = element.querySelector('[role="alert"]');
    const retry = element.querySelector('button');

    expect(alert?.textContent).toContain('common.error_generic');
    expect(retry?.textContent).toContain('common.retry');
    expect(element.textContent).not.toContain('Hola');
  });

  it('rejects malformed successful responses rather than rendering partial data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ word: 'hola' }),
      }),
    );

    const element = await render();

    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).not.toContain('hola');
  });

  it('retries the request after a transient failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          word: 'bonjour',
          translation: 'hello',
          language: 'French',
          example: 'Bonjour, comment allez-vous ?',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const element = await render();
    const retry = element.querySelector('button');
    expect(retry).not.toBeNull();

    retry?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('bonjour');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });
});
