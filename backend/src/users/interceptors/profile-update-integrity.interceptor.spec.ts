import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProfileUpdateIntegrityInterceptor } from './profile-update-integrity.interceptor';

class UsersController {}

function updateMyProfile(): void {}
function getMyProfile(): void {}

type QueryResponse = {
  data: Record<string, unknown> | null;
  error: unknown | null;
};

function createQuery(response: QueryResponse) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };
}

function createContext(
  body: Record<string, unknown>,
  options: {
    method?: string;
    user?: { id?: string; sub?: string };
    handler?: () => void;
  } = {},
): ExecutionContext {
  const request = {
    method: options.method ?? 'PATCH',
    body,
    user: options.user === undefined ? { id: 'user-1' } : options.user,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getClass: () => UsersController,
    getHandler: () => options.handler ?? updateMyProfile,
  } as unknown as ExecutionContext;
}

function createNext(value: unknown = { id: 'user-1' }): CallHandler {
  return {
    handle: vi.fn(() => of(value)),
  } as CallHandler;
}

describe('ProfileUpdateIntegrityInterceptor', () => {
  let client: { from: ReturnType<typeof vi.fn> };
  let interceptor: ProfileUpdateIntegrityInterceptor;

  beforeEach(() => {
    client = { from: vi.fn() };
    interceptor = new ProfileUpdateIntegrityInterceptor({
      getClient: vi.fn(() => client),
    } as unknown as SupabaseService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not intercept unrelated controller handlers', async () => {
    const next = createNext('ok');
    const context = createContext(
      { target_languages: ['en', 'ja'] },
      { handler: getMyProfile },
    );

    await expect(firstValueFrom(interceptor.intercept(context, next))).resolves.toBe(
      'ok',
    );
    expect(client.from).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('fails before the controller when an authenticated user is missing', () => {
    const context = createContext({}, { user: {} });

    expect(() => interceptor.intercept(context, createNext())).toThrow(
      UnauthorizedException,
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects more than one target language for a persisted non-VIP user', async () => {
    const entitlementQuery = createQuery({
      data: { is_vip: false },
      error: null,
    });
    client.from.mockReturnValueOnce(entitlementQuery);
    const next = createNext();

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({ target_languages: ['en', 'ja'] }),
          next,
        ),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(entitlementQuery.select).toHaveBeenCalledWith('is_vip');
    expect(entitlementQuery.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('fails closed when VIP entitlement cannot be verified', async () => {
    client.from.mockReturnValueOnce(
      createQuery({ data: null, error: { message: 'provider unavailable' } }),
    );
    const next = createNext();

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({ target_languages: ['en', 'ja'] }),
          next,
        ),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('allows a verified VIP to persist up to three target languages', async () => {
    const entitlementQuery = createQuery({
      data: { is_vip: true },
      error: null,
    });
    const persistenceQuery = createQuery({
      data: {
        bio_text: 'Learning Japanese',
        target_languages: ['ja', 'fr', 'es'],
        privacy_hide_from_search: true,
      },
      error: null,
    });
    client.from
      .mockReturnValueOnce(entitlementQuery)
      .mockReturnValueOnce(persistenceQuery);
    const result = {
      id: 'user-1',
      bio_text: 'Learning Japanese',
      target_languages: ['ja', 'fr', 'es'],
      privacy_hide_from_search: true,
    };
    const next = createNext(result);

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({
            bio_text: 'Learning Japanese',
            target_languages: ['ja', 'fr', 'es'],
            privacy_hide_from_search: true,
          }),
          next,
        ),
      ),
    ).resolves.toEqual(result);

    expect(persistenceQuery.select).toHaveBeenCalledWith(
      'bio_text,target_languages,privacy_hide_from_search',
    );
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('does not require a VIP lookup for the free one-language allowance', async () => {
    const persistenceQuery = createQuery({
      data: { target_languages: ['ja'] },
      error: null,
    });
    client.from.mockReturnValueOnce(persistenceQuery);
    const next = createNext({ id: 'user-1', target_languages: ['ja'] });

    await firstValueFrom(
      interceptor.intercept(
        createContext({ target_languages: ['ja'] }),
        next,
      ),
    );

    expect(client.from).toHaveBeenCalledTimes(1);
    expect(persistenceQuery.select).toHaveBeenCalledWith('target_languages');
  });

  it('turns a legacy mock-success response into an error when core fields were not persisted', async () => {
    const persistenceQuery = createQuery({
      data: { bio_text: 'Old bio' },
      error: null,
    });
    client.from.mockReturnValueOnce(persistenceQuery);
    const next = createNext({ id: 'user-1', bio_text: 'New bio' });

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({ bio_text: 'New bio' }),
          next,
        ),
      ),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('fails closed when the persisted profile cannot be read back', async () => {
    client.from.mockReturnValueOnce(
      createQuery({ data: null, error: { message: 'read failed' } }),
    );

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({ privacy_hide_age: true }),
          createNext({ id: 'user-1', privacy_hide_age: true }),
        ),
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('verifies native-language and privacy-toggle arrays/booleans exactly', async () => {
    const persistenceQuery = createQuery({
      data: {
        native_languages: ['en', 'cy'],
        privacy_hide_age: true,
        privacy_hide_location: false,
      },
      error: null,
    });
    client.from.mockReturnValueOnce(persistenceQuery);

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({
            native_languages: ['en', 'cy'],
            privacy_hide_age: true,
            privacy_hide_location: false,
          }),
          createNext(),
        ),
      ),
    ).resolves.toEqual({ id: 'user-1' });
  });

  it('does not add persistence reads for profile fields outside the issue contract', async () => {
    const next = createNext({ id: 'user-1', display_name: 'New name' });

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext({ display_name: 'New name' }),
          next,
        ),
      ),
    ).resolves.toEqual({ id: 'user-1', display_name: 'New name' });

    expect(client.from).not.toHaveBeenCalled();
  });
});
