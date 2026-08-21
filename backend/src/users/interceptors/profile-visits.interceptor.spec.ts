import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProfileVisitsService } from '../profile-visits.service';
import { ProfileVisitsInterceptor } from './profile-visits.interceptor';

function createContext(
  handlerName: string,
  visitorId = 'viewer-1',
  viewedId = 'profile-1',
): ExecutionContext {
  const handler = { [handlerName]: () => undefined }[handlerName];
  return {
    getType: () => 'http',
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: visitorId },
        params: { id: viewedId },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ProfileVisitsInterceptor', () => {
  let recordVisit: ReturnType<typeof vi.fn>;
  let interceptor: ProfileVisitsInterceptor;

  beforeEach(() => {
    recordVisit = vi.fn().mockResolvedValue(true);
    interceptor = new ProfileVisitsInterceptor({
      recordVisit,
    } as unknown as ProfileVisitsService);
  });

  it('records a successful authenticated profile view', async () => {
    const next = { handle: () => of({ id: 'profile-1' }) } as CallHandler;

    await expect(
      firstValueFrom(
        interceptor.intercept(createContext('getUserProfile'), next),
      ),
    ).resolves.toEqual({ id: 'profile-1' });
    expect(recordVisit).toHaveBeenCalledWith('viewer-1', 'profile-1');
  });

  it('does not record unrelated user endpoints', async () => {
    const next = { handle: () => of([]) } as CallHandler;

    await firstValueFrom(interceptor.intercept(createContext('getFollowers'), next));
    expect(recordVisit).not.toHaveBeenCalled();
  });

  it('does not record self views', async () => {
    const next = { handle: () => of({ id: 'user-1' }) } as CallHandler;

    await firstValueFrom(
      interceptor.intercept(
        createContext('getUserProfile', 'user-1', 'user-1'),
        next,
      ),
    );
    expect(recordVisit).not.toHaveBeenCalled();
  });

  it('does not record failed profile reads', async () => {
    const next = {
      handle: () => throwError(() => new Error('profile unavailable')),
    } as CallHandler;

    await expect(
      firstValueFrom(
        interceptor.intercept(createContext('getUserProfile'), next),
      ),
    ).rejects.toThrow('profile unavailable');
    expect(recordVisit).not.toHaveBeenCalled();
  });
});
