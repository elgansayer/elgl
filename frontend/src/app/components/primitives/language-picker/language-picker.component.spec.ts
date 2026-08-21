import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguagePickerComponent } from './language-picker.component';
import { TranslatePipe } from '../../../services/translate.pipe';

describe('LanguagePickerComponent', () => {
  let component: LanguagePickerComponent;
  let fixture: ComponentFixture<LanguagePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguagePickerComponent, TranslatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguagePickerComponent);
    component = fixture.componentInstance;
    // Set inputs if any
    fixture.componentRef.setInput('selectedCode', 'en');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open modal on openModal', () => {
    component.openModal();
    expect(component.isOpen()).toBe(true);
    expect(component.searchQuery()).toBe('');
  });

  it('should filter languages', () => {
    component.searchQuery.set('espanol');
    // 'es' should be the only one or one of a few (like es, eo etc if they match)
    // Actually espanol is not native name for 'es', Español is.
    // Let's test with 'spani' for Spanish
    component.searchQuery.set('spani');
    const filteredSpan = component.filteredLanguages();
    expect(filteredSpan.some((l) => l.code === 'es')).toBe(true);
  });

  it('should select language and close modal', () => {
    vi.spyOn(component.languageSelected, 'emit');
    component.openModal();
    component.selectLanguage('fr');
    expect(component.languageSelected.emit).toHaveBeenCalledWith('fr');
    expect(component.isOpen()).toBe(false);
  });
});
