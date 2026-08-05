import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { environment } from '../../../environments/environment';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the email form when no token query is present', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('form')).toBeTruthy();
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('should send a reset request on valid email submission', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const emailInput = compiled.querySelector('input[type="email"]') as HTMLInputElement;
    const submitButton = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;

    emailInput.value = 'user@example.com';
    emailInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submitButton.click();
    fixture.detectChanges();

    const req = httpTesting.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com' });
    req.flush({ message: 'ok' });
  });

  it('should disable the submit button while the form is invalid', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const submitButton = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBeTrue();
  });

  it('should set sendError on failed reset request', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const emailInput = compiled.querySelector('input[type="email"]') as HTMLInputElement;
    const submitButton = compiled.querySelector('button[type="submit"]') as HTMLButtonElement;

    emailInput.value = 'user@example.com';
    emailInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    submitButton.click();

    const req = httpTesting.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
    req.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.sendError()).toBe('forgot_password.send_error');
  });
});