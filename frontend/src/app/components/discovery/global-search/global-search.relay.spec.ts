import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../../services/i18n.service';
import { RecommendationsService } from '../../../services/recommendations.service';
import { GlobalSearchComponent } from './global-search.component';

describe('GlobalSearchComponent Relay presentation', () => {
  let fixture: ComponentFixture<GlobalSearchComponent>;

  beforeEach(async () => {
    const i18n = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => key),
      translations: signal<Record<string, string>>({}),
      availableLanguages: [],
    };

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18n },
        {
          provide: RecommendationsService,
          useValue: { getDiscoveryRecommendations: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalSearchComponent);
    fixture.detectChanges();
  });

  it('uses Relay card, surface, elevation and logical partner-side tokens', () => {
    const search: HTMLElement = fixture.nativeElement.querySelector('[role="search"]');

    expect(search.classList.contains('rounded-card')).toBe(true);
    expect(search.classList.contains('shadow-card')).toBe(true);
    expect(search.classList.contains('bg-surface-200')).toBe(true);
    expect(search.classList.contains('border-s-secondary')).toBe(true);
    expect(search.className).not.toContain('rounded-xl');
    expect(search.className).not.toContain('shadow-sm');
  });

  it('keeps all native selects on Relay input roles with primary focus treatment', () => {
    const selects: HTMLSelectElement[] = Array.from(fixture.nativeElement.querySelectorAll('select'));

    expect(selects).toHaveLength(3);
    for (const select of selects) {
      expect(select.className).toContain('min-h-11');
      expect(select.className).toContain('rounded-app');
      expect(select.className).toContain('bg-surface-50');
      expect(select.className).toContain('text-text-primary');
      expect(select.className).toContain('focus-visible:border-primary');
      expect(select.className).toContain('focus-visible:ring-primary/40');
      expect(select.className).not.toContain('accent');
    }
  });

  it('uses the per-user primary and semantic on-fill roles for the search action', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[hlmBtn]');

    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('rounded-app');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-on-fill');
    expect(button.className).not.toContain('bg-accent');
    expect(button.className).not.toContain('text-white');
    expect(button.className).not.toContain('active:scale');
  });

  it('keeps a mobile-first full-width layout with tablet and desktop spacing steps', () => {
    const search: HTMLElement = fixture.nativeElement.querySelector('[role="search"]');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[hlmBtn]');
    const checkboxRow: HTMLElement | null = fixture.nativeElement.querySelector(
      `[for="${fixture.componentInstance.audioIntroId}"]`,
    )?.parentElement;

    expect(search.className).toContain('p-4');
    expect(search.className).toContain('sm:p-5');
    expect(search.className).toContain('lg:p-6');
    expect(button.className).toContain('w-full');
    expect(checkboxRow?.className).toContain('flex-wrap');
    expect(checkboxRow?.className).toContain('min-h-11');
  });
});
