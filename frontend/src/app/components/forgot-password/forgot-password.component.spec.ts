import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let httpClientMock: { post: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };
  let queryParamMap: ReturnType<typeof signal>;

  beforeEach(async () => {
    queryParamMap = signal(new Map<string, string>());

    httpClientMock = {
      post: vi.fn(),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    const activatedRouteMock = {
      queryParamMap: of({
        get: (key: string) => {
          const map = queryParamMap();
          return map.get(key) ?? null;
        },
        has: (key: string) => queryParamMap().has(key),
        keys: () => queryParamMap().keys(),
        getAll: () => [],
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: HttpClient, useValue: httpClientMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show email form when no token is present', () => {
    expect(component.tokenQuery()).toBeNull();
    expect(component.emailForm).toBeDefined();
  });

  it('should show reset form when token is present', async () => {
    queryParamMap.set(new Map([['token', 'abc123']]));
    // re-create component with token
    fixture.destroy();

    const activatedRouteMock = {
      queryParamMap: of({
        get: (key: string) => {
          const map = queryParamMap();
          return map.get(key) ?? null;
        },
        has: (key: string) => queryParamMap().has(key),
        keys: () => queryParamMap().keys(),
        getAll: () => [],
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: HttpClient, useValue: httpClientMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();

    expect(component.tokenQuery()).toBe('abc123');
  });

  it('should set sendSuccess when reset request succeeds', async () => {
    httpClientMock.post.mockReturnValue(of({ message: 'ok' }));
    component.emailForm.controls.email.setValue('user@example.com');

    await component.sendResetRequest();

    expect(component.sendSuccess()).toBe(true);
    expect(component.isSending()).toBe(false);
  });

  it('should set sendError when reset request fails', async () => {
    httpClientMock.post.mockReturnValue(throwError(() => new Error('network error')));
    component.emailForm.controls.email.setValue('user@example.com');

    await component.sendResetRequest();

    expect(component.sendError()).toBe('forgot_password.send_error');
    expect(component.isSending()).toBe(false);
  });

  it('should not call API when email is invalid', async () => {
    await component.sendResetRequest();

    expect(httpClientMock.post).not.toHaveBeenCalled();
  });

  it('should navigate home after successful password reset', async () => {
    queryParamMap.set(new Map([['token', 'my-token']]));
    fixture.destroy();

    const activatedRouteMock = {
      queryParamMap: of({
        get: (key: string) => {
          const map = queryParamMap();
          return map.get(key) ?? null;
        },
        has: (key: string) => queryParamMap().has(key),
        keys: () => queryParamMap().keys(),
        getAll: () => [],
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        { provide: HttpClient, useValue: httpClientMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();

    httpClientMock.post.mockReturnValue(of({ message: 'reset ok' }));
    component.resetForm.controls.newPassword.setValue('newPass123!');

    await component.doPasswordReset();

    expect(component.resetSuccess()).toBe(true);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
  });
});