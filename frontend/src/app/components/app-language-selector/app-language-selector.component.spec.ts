import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AppLanguageSelectorComponent } from './app-language-selector.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('AppLanguageSelectorComponent', () => {
  let component: AppLanguageSelectorComponent;
  let fixture: ComponentFixture<AppLanguageSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLanguageSelectorComponent],
      providers: [
        provideHttpClient(),
        I18nService,
        TranslatePipe,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLanguageSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start closed', () => {
    expect(component.isOpen()).toBe(false);
  });

  it('should toggle modal', () => {
    component.toggleModal();
    expect(component.isOpen()).toBe(true);
    component.toggleModal();
    expect(component.isOpen()).toBe(false);
  });

  it('should select language and close', async () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    component.i18n.setLanguage = spy;
    component.isOpen.set(true);
    await component.selectLanguage('es');
    expect(spy).toHaveBeenCalledWith('es');
    expect(component.isOpen()).toBe(false);
  });
});
