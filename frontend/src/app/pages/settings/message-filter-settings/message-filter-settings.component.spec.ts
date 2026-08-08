import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from '../../../services/auth.service';
import { I18nService } from '../../../services/i18n.service';
import { TranslatePipe } from '../../../services/translate.pipe';
import { UserService } from '../../../services/user.service';
import { MessageFilterSettingsComponent } from './message-filter-settings.component';

describe('MessageFilterSettingsComponent', () => {
  let component: MessageFilterSettingsComponent;
  let fixture: ComponentFixture<MessageFilterSettingsComponent>;
  let userServiceMock: jasmine.SpyObj<UserService>;

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
    userServiceMock = jasmine.createSpyObj<UserService>('UserService', [
      'getMessageFilters',
      'setMessageFilters',
    ]);

    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        MessageFilterSettingsComponent,
      ],
      providers: [
        TranslatePipe,
        { provide: AuthService, useValue: authSpy },
        { provide: I18nService, useValue: i18nSpy },
        { provide: UserService, useValue: userServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageFilterSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with null/empty filters', () => {
    expect(component.ageMin()).toBeNull();
    expect(component.ageMax()).toBeNull();
    expect(component.selectedLanguages()).toEqual([]);
    expect(component.selectedGenders()).toEqual([]);
  });

  it('should load saved filters from user service', async () => {
    userServiceMock.getMessageFilters.and.resolveTo({
      age_min: 18,
      age_max: 45,
      allowed_native_languages: ['en', 'es'],
      allowed_genders: ['female'],
    });

    await component.ngOnInit();

    expect(component.ageMin()).toBe(18);
    expect(component.ageMax()).toBe(45);
    expect(component.selectedLanguages()).toEqual(['en', 'es']);
    expect(component.selectedGenders()).toEqual(['female']);
  });

  it('should handle empty response from getMessageFilters', async () => {
    userServiceMock.getMessageFilters.and.resolveTo({} as unknown as Record<string, unknown>);

    await component.ngOnInit();

    expect(component.ageMin()).toBeNull();
    expect(component.ageMax()).toBeNull();
    expect(component.selectedLanguages()).toEqual([]);
    expect(component.selectedGenders()).toEqual([]);
  });

  it('should toggle language selection', () => {
    component.toggleLanguage('en');
    expect(component.selectedLanguages()).toContain('en');

    component.toggleLanguage('es');
    expect(component.selectedLanguages()).toContain('en');
    expect(component.selectedLanguages()).toContain('es');

    component.toggleLanguage('en');
    expect(component.selectedLanguages()).not.toContain('en');
    expect(component.selectedLanguages()).toContain('es');
  });

  it('should toggle gender selection', () => {
    component.toggleGender('male');
    expect(component.selectedGenders()).toContain('male');

    component.toggleGender('female');
    expect(component.selectedGenders()).toContain('male');
    expect(component.selectedGenders()).toContain('female');

    component.toggleGender('male');
    expect(component.selectedGenders()).not.toContain('male');
    expect(component.selectedGenders()).toContain('female');
  });

  it('should compute hasFilters correctly', () => {
    expect(component.hasFilters()).toBe(false);

    component.ageMin.set(18);
    expect(component.hasFilters()).toBe(true);

    component.ageMin.set(null);
    component.selectedLanguages.set(['en']);
    expect(component.hasFilters()).toBe(true);

    component.selectedLanguages.set([]);
    component.selectedGenders.set(['male']);
    expect(component.hasFilters()).toBe(true);
  });

  it('should save filters and show success message', async () => {
    userServiceMock.setMessageFilters.and.resolveTo();

    component.ageMin.set(25);
    component.selectedLanguages.set(['fr']);
    await component.saveFilters();

    expect(userServiceMock.setMessageFilters).toHaveBeenCalledWith({
      age_min: 25,
      age_max: undefined,
      allowed_native_languages: ['fr'],
      allowed_genders: undefined,
    });
    expect(component.successMessage()).toBe('settings.messageFilters.saved');
  });

  it('should show error message when save fails', async () => {
    userServiceMock.setMessageFilters.and.rejectWith(new Error('Network error'));

    await component.saveFilters();

    expect(component.errorMessage()).toBe('settings.messageFilters.saveError');
  });

  it('should resolve language name from code', () => {
    expect(component.getLanguageName('en')).toBe('English');
    expect(component.getLanguageName('zz')).toBe('ZZ');
  });
});