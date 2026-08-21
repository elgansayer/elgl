import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlobalSearchComponent } from './global-search.component';
import { I18nService } from '../../../services/i18n.service';
import { ALL_LANGUAGE_CODES } from '../../primitives/language-picker/language-picker.component';

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
      providers: [{ provide: I18nService, useValue: mockI18n }],
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

  it('should render the title', () => {
    const title = fixture.nativeElement.querySelector('h2');
    expect(title.textContent.trim()).toBe('Global Search');
  });

  it('should render three dropdowns', () => {
    const selects = fixture.nativeElement.querySelectorAll('select');
    expect(selects.length).toBe(3);
  });

  it('should render the search button', () => {
    const button = fixture.nativeElement.querySelector('button[hlmBtn]');
    expect(button.textContent.trim()).toBe('Search Partners');
  });

  it('should have aria-label on search button', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button[hlmBtn]');
    expect(button.getAttribute('aria-label')).toBe('Search Partners');
  });

  it('should emit search filters on applyFilters', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((f) => emitted.push(f));

    component.nativeLanguages.set('es');
    component.targetLanguage.set('fr');
    component.level.set('b1');
    component.hasAudioIntro.set(true);
    fixture.detectChanges();

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

  it('should emit false for the audio intro filter when it is not selected', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((f) => emitted.push(f));

    component.applyFilters();

    expect(emitted).toEqual([
      {
        native_languages: undefined,
        target_language: undefined,
        proficiency_level: undefined,
        has_audio_intro: false,
      },
    ]);
  });

  it('should apply the audio intro filter immediately when toggled', () => {
    const emitted: unknown[] = [];
    component.searchFilters.subscribe((f) => emitted.push(f));

    component.toggleHasAudioIntro();

    expect(component.hasAudioIntro()).toBe(true);
    expect(emitted).toEqual([
      {
        native_languages: undefined,
        target_language: undefined,
        proficiency_level: undefined,
        has_audio_intro: true,
      },
    ]);
  });

  it('should render an associated audio intro checkbox label', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#global-hasAudioIntro');
    const label: HTMLLabelElement = fixture.nativeElement.querySelector(
      'label[for="global-hasAudioIntro"]',
    );

    expect(input).toBeTruthy();
    expect(label.textContent?.trim()).toBe('Audio Introduction');
  });

  it('should populate availableLanguages with translated names', () => {
    const langs = component.availableLanguages();
    expect(langs.length).toBe(ALL_LANGUAGE_CODES.length);

    const enEntry = langs.find((l) => l.code === 'en');
    expect(enEntry).toBeDefined();
    expect(enEntry!.flag).toBe('🇬🇧');
    expect(enEntry!.nativeName).toBeTruthy();
    expect(enEntry!.translatedName).toBeTruthy();
  });

  it('should have six proficiency levels', () => {
    expect(component.levels.length).toBe(6);
    expect(component.levels.map((l) => l.value)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2']);
  });

  it('should react to select changes', () => {
    const nativeSelect: HTMLSelectElement =
      fixture.nativeElement.querySelector('#global-nativeLanguages');

    nativeSelect.value = 'de';
    nativeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.nativeLanguages()).toBe('de');

    const targetSelect: HTMLSelectElement =
      fixture.nativeElement.querySelector('#global-targetLanguage');

    targetSelect.value = 'fr';
    targetSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.targetLanguage()).toBe('fr');

    const levelSelect: HTMLSelectElement = fixture.nativeElement.querySelector(
      '#global-proficiencyLevel',
    );

    levelSelect.value = 'c1';
    levelSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.level()).toBe('c1');
  });

  it('should recompute availableLanguages when currentLang changes', () => {
    const firstLanguage = component.availableLanguages()[0].translatedName;

    mockI18n.currentLang.set('fr');
    fixture.detectChanges();

    const secondLanguages = component.availableLanguages();
    expect(secondLanguages.length).toBe(ALL_LANGUAGE_CODES.length);
    // The translated names should differ when UI language changes
    expect(secondLanguages[0].translatedName).not.toBe(firstLanguage);
  });
});
