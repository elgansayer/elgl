import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageSettingsComponent } from './language-settings.component';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('LanguageSettingsComponent', () => {
  let component: LanguageSettingsComponent;
  let fixture: ComponentFixture<LanguageSettingsComponent>;
  let i18nMock: Partial<I18nService>;

  beforeEach(async () => {
    i18nMock = {
      currentLang: signal('en-GB'),
      availableLanguages: [
        { code: 'en-GB', name: 'British English', nativeName: 'English (UK)', flag: '🇬🇧', isRtl: false },
        { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
      ],
      setLanguage: vi.fn().mockResolvedValue(undefined),
      translate: vi.fn((key: string) => key),
      translations: signal({}),
    };

    await TestBed.configureTestingModule({
      imports: [LanguageSettingsComponent],
      providers: [
        provideHttpClient(),
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display all available languages', () => {
    expect(component.langs.length).toBe(3);
  });

  it('should highlight current language as selected', () => {
    expect(component.currentLang()).toBe('en-GB');
  });

  it('should call setLanguage when selecting a language', async () => {
    await component.selectLang('es');
    expect(i18nMock.setLanguage).toHaveBeenCalledWith('es');
  });

  it('should display language flags and names', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('English (UK)');
    expect(compiled.textContent).toContain('Español');
    expect(compiled.textContent).toContain('العربية');
  });

  it('should have a back button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const backBtn = compiled.querySelector('button');
    expect(backBtn).toBeTruthy();
  });
});