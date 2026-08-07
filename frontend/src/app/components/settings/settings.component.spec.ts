import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { SettingsComponent } from './settings.component';
import { I18nService } from '../../services/i18n.service';
import { UserService } from '../../services/user.service';
import { CacheService } from '../../services/cache.service';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { signal } from '@angular/core';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let i18nServiceMock: { currentLang: ReturnType<typeof signal<string>>; translate: ReturnType<typeof vi.fn>; setLanguage: ReturnType<typeof vi.fn>; availableLanguages: ReturnType<typeof signal<string[]>> };
  let routerMock: Partial<Router>;
  let userServiceMock: { downloadMyData: ReturnType<typeof vi.fn>; getMyProfile: ReturnType<typeof vi.fn>; getLinkedAccounts: ReturnType<typeof vi.fn>; getAvailableInterests: ReturnType<typeof vi.fn> };
  let locationMock: Partial<Location>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
      availableLanguages: signal(['en-GB', 'ja', 'ar']),
    };
    routerMock = {
      navigate: vi.fn(),
    };
    locationMock = {
      back: vi.fn(),
    };
    userServiceMock = {
      downloadMyData: vi.fn(),
      getMyProfile: vi.fn().mockResolvedValue(null),
      getLinkedAccounts: vi.fn().mockResolvedValue([]),
      getAvailableInterests: vi.fn().mockResolvedValue([]),
    };

    const cacheServiceStub = { clearCache: vi.fn().mockResolvedValue(undefined), deleteOldMedia: vi.fn().mockResolvedValue(undefined) };
    const chatSettingsStub = { loadSettings: vi.fn().mockResolvedValue(undefined), enterToSend: signal(false), textSize: signal('medium' as const) };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: Location, useValue: locationMock },
        { provide: UserService, useValue: userServiceMock },
        { provide: CacheService, useValue: cacheServiceStub },
        { provide: ChatSettingsService, useValue: chatSettingsStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the exact location privacy setting', () => {
    const initialValue = component.privacyHideExactLocation;
    component.privacyHideExactLocation = !initialValue;
    expect(component.privacyHideExactLocation).toBe(!initialValue);
  });

  it('should navigate to the My Subscription page', () => {
    component.goToMySubscription();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/my-subscription']);
  });

  it('should change the UI language', () => {
    component.changeUiLanguage('es');
    expect(i18nServiceMock.setLanguage).toHaveBeenCalledWith('es');
  });

  describe('downloadData', () => {
    it('should call downloadMyData and show success message on successful download', async () => {
      userServiceMock.downloadMyData = vi.fn().mockResolvedValue(undefined);
      component.successMessage.set('');
      component.errorMessage.set('');
      component.isDownloading.set(false);

      expect(component.isDownloading()).toBe(false);
      await component.downloadData();

      expect(component.isDownloading()).toBe(false);
      expect(component.successMessage()).toBe('Data export downloaded successfully');
      expect(component.errorMessage()).toBe('');
      expect(userServiceMock.downloadMyData).toHaveBeenCalledOnce();
    });

    it('should set error message on download failure', async () => {
      userServiceMock.downloadMyData = vi.fn().mockRejectedValue(new Error('Network error'));
      component.successMessage.set('');
      component.errorMessage.set('');
      component.isDownloading.set(false);

      await component.downloadData();

      expect(component.isDownloading()).toBe(false);
      expect(component.successMessage()).toBe('');
      expect(component.errorMessage()).toBe('Failed to download data export');
      expect(userServiceMock.downloadMyData).toHaveBeenCalledOnce();
    });
  });
});
