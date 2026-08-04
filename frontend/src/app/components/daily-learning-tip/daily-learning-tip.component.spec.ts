import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DailyLearningTipComponent } from './daily-learning-tip.component';
import { AuthService } from '../../services/auth.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('DailyLearningTipComponent', () => {
  let fixture: ComponentFixture<DailyLearningTipComponent>;
  const mockFetch = vi.fn();

  const mockAuthService = {
    getAccessToken: vi.fn().mockReturnValue('mock-access-token'),
  };

  beforeEach(async () => {
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [DailyLearningTipComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideComponent(DailyLearningTipComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DailyLearningTipComponent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it('should create', () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ tip: 'Practise daily.' }) });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sends the bearer token from AuthService when fetching the tip', () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ tip: 'Practise daily.' }) });
    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/daily-tip',
      { headers: { Authorization: 'Bearer mock-access-token' } },
    );
  });

  it('renders the fetched tip once loaded', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ tip: 'Practise daily.' }) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Practise daily.');
  });

  it('falls back to the default tip translation key when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('home.dailyTip.fallback');
  });
});
