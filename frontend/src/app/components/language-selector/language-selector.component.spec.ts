import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageSelectorComponent } from './language-selector.component';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('LanguageSelectorComponent', () => {
  let component: LanguageSelectorComponent;
  let fixture: ComponentFixture<LanguageSelectorComponent>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      availableLanguages: [
        { code: 'en-GB', name: 'British English', nativeName: 'English (UK)', flag: '🇬🇧', isRtl: false },
        { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
      ],
      translate: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LanguageSelectorComponent],
      providers: [{ provide: I18nService, useValue: i18nServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSelectorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display current language name', () => {
    expect(component.currentLanguage().name).toBe('British English');
  });

  it('should filter languages based on search query', () => {
    component.searchQuery.set('span');
    expect(component.filteredLanguages()).toHaveLength(1);
    expect(component.filteredLanguages()[0].code).toBe('es');
  });

  it('should toggle open state', () => {
    expect(component.isOpen()).toBe(false);
    component.toggle();
    expect(component.isOpen()).toBe(true);
  });

  it('should call setLanguage when selecting a language', () => {
    component.selectLanguage('es');
    expect(i18nServiceMock.setLanguage).toHaveBeenCalledWith('es');
    expect(component.isOpen()).toBe(false);
  });

  it('should expose the language name and selection state on options with role and aria-selected', async () => {
    component.isOpen.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const options = fixture.nativeElement.querySelectorAll('button[role="option"]');
    expect(options.length).toBe(2);

    const firstOption = options[0] as HTMLButtonElement;
    expect(firstOption.getAttribute('role')).toBe('option');
    expect(firstOption.getAttribute('aria-selected')).toBe('true');
    expect(firstOption.getAttribute('aria-label')).toBe('British English, common.selected');

    const secondOption = options[1] as HTMLButtonElement;
    expect(secondOption.getAttribute('role')).toBe('option');
    expect(secondOption.getAttribute('aria-selected')).toBe('false');
    expect(secondOption.getAttribute('aria-label')).toBe('Spanish');
  });
});
