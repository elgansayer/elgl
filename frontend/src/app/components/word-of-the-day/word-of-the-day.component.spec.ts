import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WordOfTheDayComponent } from './word-of-the-day.component';
import { AuthService } from '../../services/auth.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('WordOfTheDayComponent', () => {
  let fixture: ComponentFixture<WordOfTheDayComponent>;
  const mockFetch = vi.fn();

  const mockAuthService = {
    getAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  };

  beforeEach(async () => {
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [WordOfTheDayComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideComponent(WordOfTheDayComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(WordOfTheDayComponent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it('should create', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          word: 'Hola',
          translation: 'Hello',
          language: 'Spanish',
          example: '¡Hola! ¿Cómo estás?',
        }),
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sends the bearer token from AuthService when fetching the word', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          word: 'Ciao',
          translation: 'Hello / Goodbye',
          language: 'Italian',
          example: 'Ciao, come stai?',
        }),
    });
    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/word-of-the-day',
      { headers: { Authorization: 'Bearer mock-access-token' } },
    );
  });

  it('renders the fetched word once loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          word: 'Ciao',
          translation: 'Hello / Goodbye',
          language: 'Italian',
          example: 'Ciao, come stai?',
        }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ciao');
    expect(fixture.nativeElement.textContent).toContain('Hello / Goodbye');
    expect(fixture.nativeElement.textContent).toContain('Italian');
    expect(fixture.nativeElement.textContent).toContain('Ciao, come stai?');
  });

  it('falls back to the default word when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Hola');
    expect(fixture.nativeElement.textContent).toContain('Hello');
    expect(fixture.nativeElement.textContent).toContain('Spanish');
  });

  it('falls back when no token is available', async () => {
    mockAuthService.getAccessToken.mockReturnValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          word: 'Merci',
          translation: 'Thank you',
          language: 'French',
          example: 'Merci beaucoup.',
        }),
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Hola');
  });

  it('renders the loading state while fetching', () => {
    // Never resolve to keep it in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('home.wordOfDay.loading');
  });
});