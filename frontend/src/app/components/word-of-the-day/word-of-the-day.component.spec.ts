import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { WordOfTheDayComponent } from './word-of-the-day.component';

describe('WordOfTheDayComponent', () => {
  const authService = {
    getAccessToken: vi.fn(),
  };

  beforeEach(async () => {
    authService.getAccessToken.mockReset();
    vi.stubGlobal('fetch', vi.fn());

    await TestBed.configureTestingModule({
      imports: [WordOfTheDayComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) =>
              ({
                'home.wordOfDay.title': 'Word of the Day',
                'common.loading': 'Loading...',
                'common.error_generic': 'Something went wrong. Please try again.',
              })[key] ?? key,
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the authenticated daily word without mock fallback content', async () => {
    authService.getAccessToken.mockReturnValue('access-token');
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          word: '学ぶ',
          translation: 'to learn',
          language: 'Japanese',
          languageCode: 'ja',
          example: '毎日、新しいことを学びます。',
          date: '2026-08-22',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const fixture = TestBed.createComponent(WordOfTheDayComponent);
    await fixture.whenStable();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/word-of-the-day'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('学ぶ');
    expect(fixture.nativeElement.textContent).toContain('to learn');
    expect(fixture.nativeElement.textContent).not.toContain('Hola');
    const targetLanguageText =
      fixture.nativeElement.querySelectorAll('[lang="ja"]');
    expect(targetLanguageText).toHaveLength(2);
    expect(targetLanguageText[0].textContent).toContain('学ぶ');
    expect(targetLanguageText[1].textContent).toContain('毎日、新しいことを学びます。');
  });

  it('fails closed when there is no authenticated session', async () => {
    authService.getAccessToken.mockReturnValue(null);

    const fixture = TestBed.createComponent(WordOfTheDayComponent);
    await fixture.whenStable();

    expect(fetch).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Something went wrong',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Hola');
  });

  it('shows a non-destructive error state when the API is unavailable', async () => {
    authService.getAccessToken.mockReturnValue('access-token');
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }));

    const fixture = TestBed.createComponent(WordOfTheDayComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Something went wrong',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Hola');
  });

  it('rejects a malformed API response instead of rendering partial content', async () => {
    authService.getAccessToken.mockReturnValue('access-token');
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ word: '学ぶ' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const fixture = TestBed.createComponent(WordOfTheDayComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Something went wrong',
    );
    expect(fixture.nativeElement.textContent).not.toContain('学ぶ');
  });
});
