import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let i18nServiceMock: Partial<I18nService>;
  let routerMock: Partial<Router>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
    };
    routerMock = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: Router, useValue: routerMock },
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
});
