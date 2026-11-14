import { routes } from '../app.routes';
import { authGuard, guestGuard } from '../guards/auth.guard';

const byPath = (path: string) => routes.find((route) => route.path === path);

describe('authenticated route contract', () => {
  it('exposes sign-in and registration behind the guest guard', () => {
    expect(byPath('login')?.loadComponent).toBeTypeOf('function');
    expect(byPath('register')?.loadComponent).toBeTypeOf('function');
    expect(byPath('login')?.canActivate).toContain(guestGuard);
    expect(byPath('register')?.canActivate).toContain(guestGuard);
  });

  it('guards authenticated feature surfaces with the auth guard', () => {
    const guardedPaths = [
      'settings',
      'chat',
      'chat/:id',
      'subscription',
      'profile',
      'profile/:userId',
      'discovery',
      'notifications',
      'learn/lessons',
      'live/audio',
      'groups/:groupId',
      'events/:eventId',
      'onboarding',
      'change-password',
    ];

    for (const path of guardedPaths) {
      const route = byPath(path);
      expect(route, `${path} must exist`).toBeDefined();
      expect(route?.canActivate, `${path} must require auth`).toContain(
        authGuard,
      );
    }
  });

  it('keeps the marketing home route public', () => {
    expect(byPath('home')?.canActivate).toBeUndefined();
  });

  it('keeps the wildcard redirect last', () => {
    expect(routes.at(-1)?.path).toBe('**');
  });
});
