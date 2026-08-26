import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../../services/i18n.service';
import { RecommendationsService } from '../../../services/recommendations.service';
import { AppButtonPrimaryComponent } from '../../primitives/button-primary/button-primary.component';
import { ALL_LANGUAGE_CODES } from '../../primitives/language-picker/language-picker.component';
import { AppSelectComponent } from '../../primitives/select/select.component';
import { GlobalSearchComponent } from './global-search.component';

describe('GlobalSearchComponent', () => {
  let component: GlobalSearchComponent;
  let fixture: ComponentFixture<GlobalSearchComponent>;
  let mockI18n: {
    currentLang: ReturnType<typeof signal>;
    translate: ReturnType<typeof vi.fn>;
    translations: ReturnType<typeof signal>;
    availableLanguages: unknown[];
  };

  beforeEach(async () => {
    mockI18n = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => {
        const map: Record<string, string> = {
          'discovery.global_search_title': 'Global Search',
          'discovery.native_languages': 'Native Language',
          'discovery.target_language': 'Target Language',
          'discovery.proficiency_level': 'Proficiency Level',
          'discovery.any_language': 'Any language',
          'discovery.any_level': 'Any level',
          'discovery.search_button': 'Search Partners',
          'audioIntro.title': 'Audio Introduction',
          'levels.a1': 'A1 - Beginner',
          'levels.a2': 'A2 - Elementary',
          'levels.b1': 'B1 - Intermediate',
          'levels.b2': 'B2 - Upper Intermediate',
          'levels.c1': 'C1 - Advanced',
          'levels.c2': 'C2 - Proficient',
        };
        return map[key] || key;
      }),
      translations: signal<Record<string, string>>({}),
      availableLanguages: [],
    };

    await TestBed.configureTestingModule({
      imports: [GlobalSearchComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: mockI18n },
        {
          provide: RecommendationsService,
          useValue: { getDiscoveryRecommendations: vi.fn().mockResolvedValue([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GlobalSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });

  it('should render the translated named search landmark', () => {
    const search = fixture.nativeElement.querySelector('[role="search"]');
    const title = fixture.nativeElement.querySelector('h2');

    expect(search.getAttribute('aria-label')).toBe('Global Search');
    expect(title.textContent.trim()).toBe('Global Search');
  });

  it('should delegate all dropdown interactions to Relay AppSelect', () => {
    const relaySelects = fixture.debugElement.queryAll(By.directive(AppSelectComponent));
    const nativeSelects = fixture.nativeElement.querySelectorAll('select');

    expect(relaySelects).toHaveLength(3);
    expect(nativeSelects).toHaveLength(3);
  });

  it('should keep every native select associated with its translated Relay label', () => {
    const selectHosts: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('app-select'));
    expect(selectHosts).toHaveLength(3);

    expect(
      selectHosts.map((host) => {
        const label = host.querySelector('label');
        const select = host.querySelector('select');
        return {
          label: label?.textContent?.trim(),
          associated: Boolean(label && select && label.htmlFor === select.id && select.id.length > 0),
        };
      }),
    ).toEqual([
      { label: 'Native Language', associated: true },
      { label: 'Target Language', associated: true },
      { label: 'Proficiency Level', associated: true },
    ]);
  });

  it('should delegate the primary search interaction to Relay AppButtonPrimary', () => {
    const relayButton = fixture.debugElement.query(By.directive(AppButtonPrimaryComponent));
    const button: HTMLButtonElement = relayButton.nativeElement.querySelector('button');

    expect(relayButton).toBeTruthy();
    expect(button.textContent?.trim()).toBe('Search Partners');
    expect(button.getAttribute('aria-label')).toBeNull();
  });

  it('should emit selected filters on applyFilters', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((filters) => emitted.push(filters));

    component.nativeLanguages.set('es');
    component.targetLanguage.set('fr');
    component.level.set('b1');
    component.hasAudioIntro.set(true);

    component.applyFilters();

    expect(emitted).toEqual([
      {
        native_languages: 'es',
        target_language: 'fr',
        proficiency_level: 'b1',
        has_audio_intro: true,
      },
    ]);
  });

  it('should emit explicit clear values for Any and an unchecked audio requirement', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((filters) => emitted.push(filters));

    component.applyFilters();

    expect(emitted).toEqual([
      {
        native_languages: '',
        target_language: '',
        proficiency_level: '',
        has_audio_intro: false,
      },
    ]);
  });

  it('should clear previously selected filters instead of omitting the clear operation', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((filters) => emitted.push(filters));

    component.nativeLanguages.set('es');
    component.targetLanguage.set('fr');
    component.level.set('b1');
    component.hasAudioIntro.set(true);
    component.applyFilters();

    component.nativeLanguages.set('');
    component.targetLanguage.set('');
    component.level.set('');
    component.hasAudioIntro.set(false);
    component.applyFilters();

    expect(emitted.at(-1)).toEqual({
      native_languages: '',
      target_language: '',
      proficiency_level: '',
      has_audio_intro: false,
    });
  });

  it('should apply the checkbox value supplied by Spartan without manually inverting state', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((filters) => emitted.push(filters));

    component.onAudioIntroChange(true);
    component.onAudioIntroChange(false);

    expect(component.hasAudioIntro()).toBe(false);
    expect(emitted).toEqual([
      {
        native_languages: '',
        target_language: '',
        proficiency_level: '',
        has_audio_intro: true,
      },
      {
        native_languages: '',
        target_language: '',
        proficiency_level: '',
        has_audio_intro: false,
      },
    ]);
  });

  it('should render an instance-safe associated audio intro checkbox label', () => {
    const input = fixture.nativeElement.querySelector(`[id="${component.audioIntroId}"]`);
    const label: HTMLLabelElement = fixture.nativeElement.querySelector(
      `label[for="${component.audioIntroId}"]`,
    );

    expect(component.audioIntroId).toMatch(/^global-hasAudioIntro-/);
    expect(input).toBeTruthy();
    expect(label.textContent?.trim()).toBe('Audio Introduction');
  });

  it('should emit search filters exactly once from the Relay primary action', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((filters) => emitted.push(filters));
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('app-button-primary button');

    button.click();

    expect(emitted).toHaveLength(1);
  });

  it('should populate availableLanguages with translated names', () => {
    const langs = component.availableLanguages();
    expect(langs.length).toBe(ALL_LANGUAGE_CODES.length);

    const enEntry = langs.find((language) => language.code === 'en');
    expect(enEntry).toBeDefined();
    expect(enEntry!.flag).toBe('🇬🇧');
    expect(enEntry!.nativeName).toBeTruthy();
    expect(enEntry!.translatedName).toBeTruthy();
  });

  it('should have six proficiency levels', () => {
    expect(component.levels.length).toBe(6);
    expect(component.levels.map((level) => level.value)).toEqual([
      'a1',
      'a2',
      'b1',
      'b2',
      'c1',
      'c2',
    ]);
  });

  it('should react to native select changes through the Relay wrappers', () => {
    const nativeSelects: HTMLSelectElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('select'),
    );

    nativeSelects[0].value = 'de';
    nativeSelects[0].dispatchEvent(new Event('change'));
    nativeSelects[1].value = 'fr';
    nativeSelects[1].dispatchEvent(new Event('change'));
    nativeSelects[2].value = 'c1';
    nativeSelects[2].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.nativeLanguages()).toBe('de');
    expect(component.targetLanguage()).toBe('fr');
    expect(component.level()).toBe('c1');
  });

  it('should recompute availableLanguages when currentLang changes', () => {
    const firstLanguage = component.availableLanguages()[0].translatedName;

    mockI18n.currentLang.set('fr');
    fixture.detectChanges();

    const secondLanguages = component.availableLanguages();
    expect(secondLanguages.length).toBe(ALL_LANGUAGE_CODES.length);
    expect(secondLanguages[0].translatedName).not.toBe(firstLanguage);
  });
});
