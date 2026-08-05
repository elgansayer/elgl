import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { signal } from '@angular/core';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  const mockI18n = {
    translate: (key: string) => key,
    currentLang: signal('en-GB'),
    baseDictionary: {},
    translations: signal({}),
  };

  const mockRouter = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };

  function buildMockAuthService() {
    return {
      requestPasswordReset: jasmine.createSpy('requestPasswordReset').and.returnValue(Promise.resolve()),
      resetPassword: jasmine.createSpy('resetPassword').and.returnValue(Promise.resolve()),
    };
  }

  function buildActivatedRoute(tokenValue: string | null) {
    const paramMap = new Map<string, string>();
    if (tokenValue) paramMap.set('token', tokenValue);
    return {
      provide: ActivatedRoute,
      useValue: {
        queryParamMap: signal(paramMap),
      },
    };
  }

  let mockAuthService: ReturnType<typeof buildMockAuthService>;

  beforeEach(async () => {
    mockAuthService = buildMockAuthService();

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        buildActivatedRoute(null),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show email form when no token query param', () => {
    const emailInput = fixture.nativeElement.querySelector('#email');
    expect(emailInput).toBeTruthy();
    const newPasswordInput = fixture.nativeElement.querySelector('#newPassword');
    expect(newPasswordInput).toBeNull();
  });

  it('should show reset form when token query param is present', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        buildActivatedRoute('test-token'),
      ],
    }).compileComponents();

    const innerFixture = TestBed.createComponent(ForgotPasswordComponent);
    innerFixture.detectChanges();

    const newPasswordInput = innerFixture.nativeElement.querySelector('#newPassword');
    expect(newPasswordInput).toBeTruthy();
    const emailInput = innerFixture.nativeElement.querySelector('#email');
    expect(emailInput).toBeNull();
  });

  it('should send reset request on valid email form submit', async () => {
    component.emailForm.controls.email.setValue('test@test.com');
    expect(component.emailForm.valid).toBeTrue();

    await component.sendResetRequest();

    expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test@test.com');
    expect(component.sendSuccess()).toBeTrue();
    expect(component.sendError()).toBeNull();
  });

  it('should show error on failed reset request', async () => {
    mockAuthService.requestPasswordReset.and.returnValue(Promise.reject(new Error('network error')));
    component.emailForm.controls.email.setValue('test@test.com');

    await component.sendResetRequest();

    expect(component.sendError()).toBe('forgot_password.send_error');
  });

  it('should send password reset on valid reset form submit', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        buildActivatedRoute('abc-token'),
      ],
    }).compileComponents();

    const innerFixture = TestBed.createComponent(ForgotPasswordComponent);
    const innerComponent = innerFixture.componentInstance;
    innerFixture.detectChanges();

    innerComponent.resetForm.controls.newPassword.setValue('newPassword123');
    expect(innerComponent.resetForm.valid).toBeTrue();

    await innerComponent.doPasswordReset();

    expect(mockAuthService.resetPassword).toHaveBeenCalledWith('abc-token', 'newPassword123');
    expect(innerComponent.resetSuccess()).toBeTrue();
    expect(innerComponent.resetError()).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('should show error on failed password reset', async () => {
    mockAuthService.resetPassword.and.returnValue(Promise.reject(new Error('network error')));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService },
        buildActivatedRoute('abc-token'),
      ],
    }).compileComponents();

    const innerFixture = TestBed.createComponent(ForgotPasswordComponent);
    const innerComponent = innerFixture.componentInstance;
    innerFixture.detectChanges();

    innerComponent.resetForm.controls.newPassword.setValue('newPassword123');

    await innerComponent.doPasswordReset();

    expect(innerComponent.resetError()).toBe('forgot_password.reset_error');
  });
});