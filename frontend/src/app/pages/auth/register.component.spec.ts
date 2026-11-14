import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Mock } from 'vitest';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../services/auth.service';

describe('RegisterComponent', () => {
  let auth: {
    signUpWithEmail: Mock;
    isAuthenticated: Mock;
  };
  let navigateByUrl: Mock;

  beforeEach(() => {
    auth = {
      signUpWithEmail: vi.fn().mockResolvedValue({
        user: { id: 'user-1' },
        error: null,
      }),
      isAuthenticated: vi.fn().mockReturnValue(false),
    };

    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    navigateByUrl = vi.fn().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(
      navigateByUrl,
    );
  });

  const create = () => TestBed.createComponent(RegisterComponent).componentInstance;

  it('rejects a short password before calling the provider', async () => {
    const component = create();
    component.email.set('learner@example.com');
    component.password.set('short');
    component.confirmPassword.set('short');

    await component.submit();

    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
    expect(component.errorKey()).toBe('auth.register.passwordTooShort');
  });

  it('rejects mismatched passwords before calling the provider', async () => {
    const component = create();
    component.email.set('learner@example.com');
    component.password.set('secret-password');
    component.confirmPassword.set('different-password');

    await component.submit();

    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
    expect(component.errorKey()).toBe('auth.register.passwordMismatch');
  });

  it('creates the account and asks the user to confirm their email', async () => {
    const component = create();
    component.email.set('learner@example.com');
    component.password.set('secret-password');
    component.confirmPassword.set('secret-password');

    await component.submit();

    expect(auth.signUpWithEmail).toHaveBeenCalledWith(
      'learner@example.com',
      'secret-password',
    );
    expect(component.submitted()).toBe(true);
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('continues to onboarding when the provider returns a session', async () => {
    auth.isAuthenticated.mockReturnValue(true);
    const component = create();
    component.email.set('learner@example.com');
    component.password.set('secret-password');
    component.confirmPassword.set('secret-password');

    await component.submit();

    expect(navigateByUrl).toHaveBeenCalledWith('/onboarding');
  });

  it('reports a provider failure', async () => {
    auth.signUpWithEmail.mockResolvedValue({
      user: null,
      error: { message: 'already registered' },
    });
    const component = create();
    component.email.set('learner@example.com');
    component.password.set('secret-password');
    component.confirmPassword.set('secret-password');

    await component.submit();

    expect(component.errorKey()).toBe('auth.register.error');
    expect(component.submitted()).toBe(false);
  });
});
