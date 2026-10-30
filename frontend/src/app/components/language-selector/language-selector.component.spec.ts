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
      translate: vi.fn((key: string) => (key === 'common.selected' ? 'Selected' : key)),
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

  it('should assign accessible labels with language name and selection state', async () => {
    component.toggle();
    fixture.detectChanges();
    await fixture.whenStable();

    const options = fixture.nativeElement.querySelectorAll('button[role="option"]');
    expect(options).toHaveLength(2);

    // Selected option (British English)
    expect(options[0].getAttribute('aria-label')).toBe('British English, Selected');
    expect(options[0].getAttribute('aria-selected')).toBe('true');

    // Unselected option (Spanish)
    expect(options[1].getAttribute('aria-label')).toBe('Spanish');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
  });

  it('should close on Escape keydown', async () => {
    component.toggle();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.isOpen()).toBe(true);

    const rootElement = fixture.nativeElement.firstElementChild as HTMLElement;
    rootElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isOpen()).toBe(false);
  });
});
