import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { environment } from '../../../environments/environment';
import { of } from 'rxjs';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;
  let activatedRoute: { queryParamMap: ReturnType<typeof of> };

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    activatedRoute = { queryParamMap: of(new Map()) as ReturnType<typeof of> };

    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [
        TranslatePipe,
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, _params?: Record<string, unknown>) => key,
          },
        },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: activatedRoute,
        },
      ],
    });

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should render the email form when no token query param', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
    expect(compiled.querySelector('input[type="password"]')).toBeFalsy();
  });

  it('should enable send button when email is valid', () => {
    component.emailForm.controls.email.setValue('user@example.com');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button[type="submit"]');
    expect(button?.hasAttribute('disabled')).toBeFalse();
  });

  it('should POST to request-password-reset and show success', () => {
    component.emailForm.controls.email.setValue('user@example.com');
    component.sendResetRequest();
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'user@example.com' });
    req.flush({ message: 'ok' });

    fixture.detectChanges();

    expect(component.sendSuccess()).toBeTrue();
  });

  it('should show error on failed send request', () => {
    component.emailForm.controls.email.setValue('user@example.com');
    component.sendResetRequest();
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/request-password-reset`);
    req.error(new ErrorEvent('Network error'));
    fixture.detectChanges();

    expect(component.sendError()).toBe('forgot_password.send_error');
  });
});