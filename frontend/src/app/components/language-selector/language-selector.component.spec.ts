import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageSelectorComponent } from './language-selector.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('LanguageSelectorComponent', () => {
  let component: LanguageSelectorComponent;
  let fixture: ComponentFixture<LanguageSelectorComponent>;
  let i18nService: I18nService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LanguageSelectorComponent, TranslatePipe],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSelectorComponent);
    component = fixture.componentInstance;
    i18nService = TestBed.inject(I18nService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle modal open and closed', () => {
    expect(component.isOpen()).toBe(false);
    component.toggleModal();
    expect(component.isOpen()).toBe(true);
    component.closeModal();
    expect(component.isOpen()).toBe(false);
  });

  it('should change language when selected', async () => {
    await component.selectLanguage('es');
    expect(i18nService.currentLang()).toBe('es');
    expect(component.isOpen()).toBe(false);
  });

  it('should apply custom language from input e.g. sw', async () => {
    component.customCode.set('sw');
    await component.applyCustomLanguage();
    expect(i18nService.currentLang()).toBe('sw');
    expect(component.customCode()).toBe('');
  });
});
