import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { LanguageSelectorComponent } from './language-selector.component';
import { I18nService } from '../../services/i18n.service';
import { ProficiencyService } from '../../services/proficiency.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('LanguageSelectorComponent', () => {
  let component: LanguageSelectorComponent;
  let fixture: ComponentFixture<LanguageSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageSelectorComponent],
      providers: [
        provideHttpClient(),
        I18nService,
        ProficiencyService,
        TranslatePipe,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSelectorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('userId', 'test-user-123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have access to availableLanguages', () => {
    expect(component.availableLanguages.length).toBeGreaterThan(0);
  });

  it('should start with no target languages', () => {
    expect(component.targetLanguages().length).toBe(0);
  });

  it('should add a target language when addTargetLanguage is called', () => {
    component.selectedNativeLang.set('en-GB');
    component.addTargetLanguage();
    expect(component.targetLanguages().length).toBe(1);
  });

  it('should not add more than 3 target languages', () => {
    component.selectedNativeLang.set('en-GB');
    for (let i = 0; i < 5; i++) {
      component.addTargetLanguage();
    }
    expect(component.targetLanguages().length).toBe(3);
  });
});
