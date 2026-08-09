import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { MessageFilterSettingsComponent } from './message-filter-settings.component';

describe('MessageFilterSettingsComponent', () => {
  let component: MessageFilterSettingsComponent;
  let fixture: ComponentFixture<MessageFilterSettingsComponent>;

  beforeEach(async () => {
    const authSpy = {
      getAccessToken: () => 'test-token',
      getBearerHeaders: () => ({ Authorization: 'Bearer test-token' }),
    };
    const i18nSpy = {
      translate: (key: string) => key,
      locale: () => 'en',
      isRtl: () => false,
      setLocale: () => {},
      onLocaleChange: { subscribe: () => {} },
    };

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        MessageFilterSettingsComponent,
      ],
      providers: [
        TranslatePipe,
        { provide: AuthService, useValue: authSpy },
        { provide: I18nService, useValue: i18nSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageFilterSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with empty filters', () => {
    expect(component.ageMin()).toBeNull();
    expect(component.ageMax()).toBeNull();
    expect(component.allowedGenders()).toEqual([]);
    expect(component.allowedNativeLanguages()).toEqual([]);
  });

  it('should toggle gender selection', () => {
    component['toggleGender']('male');
    expect(component.allowedGenders()).toContain('male');

    component['toggleGender']('female');
    expect(component.allowedGenders()).toContain('male');
    expect(component.allowedGenders()).toContain('female');

    component['toggleGender']('male');
    expect(component.allowedGenders()).not.toContain('male');
    expect(component.allowedGenders()).toContain('female');
  });

  it('should toggle native language selection', () => {
    component['toggleNativeLanguage']('en');
    expect(component.allowedNativeLanguages()).toContain('en');

    component['toggleNativeLanguage']('en');
    expect(component.allowedNativeLanguages()).not.toContain('en');
  });

  it('should clear age filters', () => {
    component.ageMin.set(18);
    component.ageMax.set(45);
    component['clearAgeFilters']();
    expect(component.ageMin()).toBeNull();
    expect(component.ageMax()).toBeNull();
  });

  it('should clear all filters', () => {
    component.ageMin.set(18);
    component.ageMax.set(45);
    component.allowedGenders.set(['male']);
    component.allowedNativeLanguages.set(['en']);
    component['clearAllFilters']();
    expect(component.ageMin()).toBeNull();
    expect(component.ageMax()).toBeNull();
    expect(component.allowedGenders()).toEqual([]);
    expect(component.allowedNativeLanguages()).toEqual([]);
  });
});