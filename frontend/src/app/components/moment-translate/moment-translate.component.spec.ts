import { TestBed } from '@angular/core/testing';
import { MomentTranslateComponent } from './moment-translate.component';
import { TranslationCacheService } from '../../services/translation-cache.service';
import { I18nService } from '../../services/i18n.service';
import { environment } from '../../../environments/environment';

describe('MomentTranslateComponent', () => {
  let translationCache: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    translationCache = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [MomentTranslateComponent],
      providers: [
        { provide: TranslationCacheService, useValue: translationCache },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts collapsed and toggles the translation panel', () => {
    const fixture = TestBed.createComponent(MomentTranslateComponent);
    fixture.componentRef.setInput('text', 'Hola');
    const component = fixture.componentInstance;

    expect(component.showTranslation()).toBe(false);
    component.toggle();
    expect(component.showTranslation()).toBe(true);
    component.toggle();
    expect(component.showTranslation()).toBe(false);
  });

  it('requests the translation for the moment text and target language', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ translation: 'Hello' }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const fixture = TestBed.createComponent(MomentTranslateComponent);
    fixture.componentRef.setInput('text', 'Hola');
    fixture.componentRef.setInput('targetLanguage', 'en-GB');
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fetchMock).toHaveBeenCalledWith(
      `${environment.apiUrl}/nlp/translate`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Hola', target_language: 'en-GB' }),
      }),
    );
    expect(fixture.componentInstance.cachedTranslation()).toBe('Hello');
    expect(translationCache.set).toHaveBeenCalledWith('Hola', 'en-GB', 'Hello');
    expect(fixture.nativeElement.textContent).toContain('Hello');
  });

  it('serves a persisted cache hit without a network request', async () => {
    translationCache.get.mockReturnValue('Bonjour');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const fixture = TestBed.createComponent(MomentTranslateComponent);
    fixture.componentRef.setInput('text', 'Hello');
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cachedTranslation()).toBe('Bonjour');
  });

  it('surfaces the translated error copy when the provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response),
    );

    const fixture = TestBed.createComponent(MomentTranslateComponent);
    fixture.componentRef.setInput('text', 'Hola');
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.cachedTranslation()).toBe(
      'moments.transError',
    );
    expect(fixture.nativeElement.textContent).toContain('moments.transError');
    expect(translationCache.set).not.toHaveBeenCalled();
  });

  it('exposes an accessible toggle control', () => {
    const fixture = TestBed.createComponent(MomentTranslateComponent);
    fixture.componentRef.setInput('text', 'Hola');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button?.textContent?.trim()).not.toBe('');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });
});
