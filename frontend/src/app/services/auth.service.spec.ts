import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { Session, User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { FcmService } from './fcm.service';
import { SupabaseService } from './supabase.service';

describe('AuthService', () => {
  let authStateCallback: ((event: string, session: Session | null) => void) | undefined;

  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  };

  const supabaseService = {
    getClient: vi.fn(() => ({ auth })),
    getEarnedBadges: vi.fn().mockResolvedValue({
      isVip: false,
      vipTier: 'free',
      isSeriousLearner: false,
    }),
  };

  const fcmService = {
    unregisterToken: vi.fn().mockResolvedValue(undefined),
  };

  const makeUser = (id = 'user-1'): User =>
    ({
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${id}@example.com`,
      app_metadata: {},
      user_metadata: { display_name: 'Learner' },
      created_at: '2026-01-01T00:00:00.000Z',
    }) as User;

  const makeSession = (id = 'user-1'): Session => ({
    access_token: `access-${id}`,
    refresh_token: `refresh-${id}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: makeUser(id),
  });

  const flushAuthInit = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = undefined;
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockImplementation((callback) => {
      authStateCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    auth.signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: null }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    supabaseService.getEarnedBadges.mockResolvedValue({
      isVip: false,
      vipTier: 'free',
      isSeriousLearner: false,
    });
    fcmService.unregisterToken.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        { provide: SupabaseService, useValue: supabaseService },
        { provide: FcmService, useValue: fcmService },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('fails closed when Supabase has no persisted session', async () => {
    const service = TestBed.inject(AuthService);

    await flushAuthInit();

    expect(service.currentSession()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isLoading()).toBe(false);
  });

  it('restores the authenticated user from the persisted Supabase session', async () => {
    const session = makeSession('restored-user');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    const service = TestBed.inject(AuthService);
    await flushAuthInit();

    expect(service.currentSession()).toBe(session);
    expect(service.currentUser()?.id).toBe('restored-user');
    expect(service.isAuthenticated()).toBe(true);
    expect(supabaseService.getEarnedBadges).toHaveBeenCalledWith('restored-user');
  });

  it('clears user and token state when Supabase emits a signed-out session', async () => {
    const session = makeSession('signed-in-user');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    const service = TestBed.inject(AuthService);
    await flushAuthInit();
    expect(service.isAuthenticated()).toBe(true);

    authStateCallback?.('SIGNED_OUT', null);

    expect(service.currentSession()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.getAccessToken()).toBeUndefined();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('stores the real Supabase session after email/password sign-in', async () => {
    const session = makeSession('email-user');
    auth.signInWithPassword.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    const service = TestBed.inject(AuthService);
    await flushAuthInit();
    const result = await service.signInWithEmail('email-user@example.com', 'secret');

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'email-user@example.com',
      password: 'secret',
    });
    expect(result.error).toBeNull();
    expect(result.user?.id).toBe('email-user');
    expect(service.currentSession()).toBe(session);
    expect(service.getAccessToken()).toBe('access-email-user');
  });

  it.each([
    ['google', 'signInWithGoogle'],
    ['apple', 'signInWithApple'],
  ] as const)('starts %s OAuth through Supabase with a first-party redirect', async (provider, method) => {
    const service = TestBed.inject(AuthService);
    await flushAuthInit();

    await service[method]();

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: { redirectTo: window.location.origin },
    });
  });

  it('fails closed and completes initialization when session restoration fails', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('session restore failed'),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = TestBed.inject(AuthService);
    await flushAuthInit();

    expect(service.currentSession()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isLoading()).toBe(false);
    expect(warn).toHaveBeenCalledWith('Failed to restore authentication session');

    warn.mockRestore();
  });

  it('clears local auth state only after Supabase sign-out succeeds', async () => {
    const session = makeSession('signout-user');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });

    const service = TestBed.inject(AuthService);
    await flushAuthInit();
    const result = await service.signOut();

    expect(fcmService.unregisterToken).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
    expect(service.currentSession()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });
});
