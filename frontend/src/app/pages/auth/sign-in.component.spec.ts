import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import type { Mock } from 'vitest';
import { SignInComponent } from './sign-in.component';
import { AuthService } from '../../services/auth.service';

describe('SignInComponent', () => {
  let auth: {
    signInWithEmail: Mock;
    signInWithGoogle: Mock;
    signInWithApple: Mock;
    isAuthenticated: Mock;
  };
  let navigateByUrl: Mock;

  const create = (returnUrl: string | null = '/settings') => {
    TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl === null ? {} : { returnUrl }) } },
        },
        { provide: AuthService, useValue: auth },
      ],
    });
    const fixture = TestBed.createComponent(SignInComponent);
    navigateByUrl = vi.fn().mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(
      navigateByUrl,
    );
    return fixture.componentInstance;
  };

  beforeEach(() => {
    auth = {
      signInWithEmail: vi
        .fn()
        .mockResolvedValue({ user: { id: 'user-1' }, error: null }),
      signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
      signInWithApple: vi.fn().mockResolvedValue({ error: null }),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };
  });

  it('signs in with email and returns to the requested route', async () => {
    const component = create('/settings?tab=chat');
    component.email.set('learner@example.com');
    component.password.set('secret-password');

    await component.submit();

    expect(auth.signInWithEmail).toHaveBeenCalledWith(
      'learner@example.com',
      'secret-password',
    );
    expect(navigateByUrl).toHaveBeenCalledWith('/settings?tab=chat');
  });

  it('ignores an unsafe return URL', async () => {
    const component = create('//evil.example/path');
    component.email.set('learner@example.com');
    component.password.set('secret-password');

    await component.submit();

    expect(navigateByUrl).toHaveBeenCalledWith('/learn/ai-chat');
  });

  it('requires both credentials before calling the provider', async () => {
    const component = create();
    component.email.set('learner@example.com');

    await component.submit();

    expect(auth.signInWithEmail).not.toHaveBeenCalled();
    expect(component.errorKey()).toBe('auth.signIn.missingCredentials');
  });

  it('surfaces provider errors without navigating', async () => {
    auth.signInWithEmail.mockResolvedValue({
      user: null,
      error: { message: 'Invalid login credentials' },
    });
    const component = create();
    component.email.set('learner@example.com');
    component.password.set('wrong-password');

    await component.submit();

    expect(component.errorKey()).toBe('auth.signIn.invalidCredentials');
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });

  it('starts Google and Apple OAuth through AuthService', async () => {
    const component = create();

    await component.social('google');
    await component.social('apple');

    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(auth.signInWithApple).toHaveBeenCalledTimes(1);
  });

  it('reports a social provider failure', async () => {
    auth.signInWithGoogle.mockResolvedValue({
      error: { message: 'provider unavailable' },
    });
    const component = create();

    await component.social('google');

    expect(component.errorKey()).toBe('auth.signIn.socialFailed');
  });
});
