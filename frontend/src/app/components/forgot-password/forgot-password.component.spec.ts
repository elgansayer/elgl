import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let route: ActivatedRoute;

  const mockRouter = {
    navigate: jest.fn(),
    navigateByUrl: jest.fn(),
  };

  function createComponent(queryParams: Record<string, string> = {}) {
    return TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ForgotPasswordComponent],
      providers: [
        TranslatePipe,
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(new Map(Object.entries(queryParams))),
            snapshot: { queryParamMap: { get: () => null } },
          },
        },
      ],
    })
      .overridePipe(TranslatePipe, {
        set: {
          transform: (key: string) => key,
        },
      })
      .compileComponents();
  }

  beforeEach(async () => {
    await createComponent();
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    route = TestBed.inject(ActivatedRoute);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('email form', () => {
    it('should show the email form when no token is present', () => {
      const emailInput = fixture.nativeElement.querySelector('#email');
      expect(emailInput).toBeTruthy();
    });

    it('should validate email as required', () => {
      const emailControl = component.emailForm.controls.email;
      emailControl.setValue('');
      expect(emailControl.valid).toBe(false);
      expect(emailControl.hasError('required')).toBe(true);
    });

    it('should validate email format', () => {
      const emailControl = component.emailForm.controls.email;
      emailControl.setValue('invalid');
      expect(emailControl.valid).toBe(false);
      expect(emailControl.hasError('email')).toBe(true);

      emailControl.setValue('valid@example.com');
      expect(emailControl.valid).toBe(true);
    });

    it('should disable the send button when form is invalid', () => {
      component.emailForm.controls.email.setValue('');
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
    });

    it('should send the reset request and show success message', async () => {
      component.emailForm.controls.email.setValue('user@example.com');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      button.click();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'user@example.com' });
      req.flush({ message: 'If the email address exists, a reset link has been sent.' });

      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.sendSuccess()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('forgot_password.sent_message');
    });

    it('should show error when the request fails', async () => {
      component.emailForm.controls.email.setValue('user@example.com');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      button.click();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
      req.error(new ProgressEvent('Network error'));

      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.sendError()).toBe('Failed to send reset request');
    });
  });

  describe('password reset form', () => {
    beforeEach(async () => {
      await createComponent({ token: 'test-token-123' });
      fixture = TestBed.createComponent(ForgotPasswordComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should show the reset form when token is present', () => {
      const passwordInput = fixture.nativeElement.querySelector('#newPassword');
      expect(passwordInput).toBeTruthy();
    });

    it('should validate password minimum length', () => {
      const passwordControl = component.resetForm.controls.newPassword;
      passwordControl.setValue('short');
      expect(passwordControl.valid).toBe(false);
      expect(passwordControl.hasError('minlength')).toBe(true);

      passwordControl.setValue('longenough123');
      expect(passwordControl.valid).toBe(true);
    });

    it('should reset the password and navigate to home', async () => {
      component.resetForm.controls.newPassword.setValue('newPassword123');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      button.click();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/reset-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        token: 'test-token-123',
        newPassword: 'newPassword123',
      });
      req.flush({ message: 'Password successfully reset' });

      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.resetSuccess()).toBe(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should show error when password reset fails', async () => {
      component.resetForm.controls.newPassword.setValue('newPassword123');
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      button.click();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/reset-password`);
      req.error(new ProgressEvent('Network error'));

      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.resetError()).toBe('Failed to reset password');
    });

    it('should disable button when password is too short', () => {
      component.resetForm.controls.newPassword.setValue('short');
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(button.disabled).toBe(true);
    });
  });
});