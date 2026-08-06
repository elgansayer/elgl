import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent, HttpClientTestingModule],
      providers: [
        provideRouter([
          { path: 'forgot-password', component: ForgotPasswordComponent },
          { path: 'home', component: ForgotPasswordComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render the forgot password title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('forgot_password.title');
  });

  it('should show the email form when no token query param is present', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('form')).toBeTruthy();
    expect(el.querySelector('input[type="email"]')).toBeTruthy();
  });

  it('should call the password reset API on form submit and show success', () => {
    component.emailForm.controls.email.setValue('user@example.com');
    component.sendResetRequest();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com' });
    req.flush({ message: 'success' });

    expect(component.sendSuccess()).toBeTrue();
    expect(component.isSending()).toBeFalse();
  });

  it('should show error when the API call fails', () => {
    component.emailForm.controls.email.setValue('user@example.com');
    component.sendResetRequest();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
    req.flush({}, { status: 500, statusText: 'Server Error' });

    expect(component.sendError()).toBe('forgot_password.send_error');
    expect(component.isSending()).toBeFalse();
  });

  it('should not call API when email form is invalid', () => {
    component.emailForm.controls.email.setValue('');
    void component.sendResetRequest();
    httpMock.expectNone(`${environment.apiUrl}/auth/request-password-reset`);
  });

  it('should disable the submit button while sending', () => {
    component.isSending.set(true);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(btn?.hasAttribute('disabled')).toBeTrue();
  });
});