import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LanguagePartiesComponent } from './language-parties.component';
import { I18nService } from '../../services/i18n.service';

describe('LanguagePartiesComponent', () => {
  let component: LanguagePartiesComponent;
  let fixture: ComponentFixture<LanguagePartiesComponent>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      availableLanguages: [],
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params) return `${key}(${JSON.stringify(params)})`;
        return key;
      }),
      setLanguage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LanguagePartiesComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguagePartiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default filter values', () => {
    expect(component.filterLanguagePair()).toBe('');
    expect(component.filterTopic()).toBe('');
    expect(component.filterLevel()).toBe('');
    expect(component.showCreateModal()).toBe(false);
  });

  it('should expose language pair options', () => {
    expect(component.languagePairOptions.length).toBe(12);
    expect(component.languagePairOptions[0].value).toBe('en-es');
  });

  it('should expose topic options', () => {
    expect(component.topicOptions.length).toBe(9);
    expect(component.topicOptions[0].value).toBe('Free Talk');
  });

  it('should expose level options', () => {
    expect(component.levelOptions.length).toBe(4);
    expect(component.levelOptions[0].value).toBe('beginner');
  });

  it('should open create modal', () => {
    expect(component.showCreateModal()).toBe(false);
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
  });

  it('should close create modal', () => {
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
    component.closeCreateModal();
    expect(component.showCreateModal()).toBe(false);
  });

  it('should clear filters', () => {
    component.filterLanguagePair.set('en-es');
    component.filterTopic.set('Free Talk');
    component.filterLevel.set('beginner');
    expect(component.activeFilterCount()).toBe(3);

    component.clearFilters();
    expect(component.filterLanguagePair()).toBe('');
    expect(component.filterTopic()).toBe('');
    expect(component.filterLevel()).toBe('');
    expect(component.activeFilterCount()).toBe(0);
  });

  it('should compute activeFilterCount correctly', () => {
    expect(component.activeFilterCount()).toBe(0);
    component.filterLanguagePair.set('en-es');
    expect(component.activeFilterCount()).toBe(1);
    component.filterTopic.set('Free Talk');
    expect(component.activeFilterCount()).toBe(2);
    component.filterLevel.set('beginner');
    expect(component.activeFilterCount()).toBe(3);
  });

  it('should initialise partiesResource', () => {
    expect(component.partiesResource).toBeDefined();
    expect(component.parties()).toEqual([]);
  });

  it('should render the title', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('languageParty.title');
  });

  it('should render the create button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const createBtn = el.querySelector('button');
    expect(createBtn?.textContent).toContain('languageParty.createButton');
  });

  it('should not render modal by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-language-party-create-modal')).toBeNull();
  });

  it('should render modal when showCreateModal is true', () => {
    component.showCreateModal.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-language-party-create-modal')).toBeTruthy();
  });

  it('should open modal when create button is clicked', () => {
    const el: HTMLElement = fixture.nativeElement;
    const createBtn = el.querySelector('button') as HTMLButtonElement;
    createBtn.click();
    fixture.detectChanges();
    expect(component.showCreateModal()).toBe(true);
  });
});
