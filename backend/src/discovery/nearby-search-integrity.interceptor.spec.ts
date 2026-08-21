import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { NearbySearchIntegrityInterceptor } from './nearby-search-integrity.interceptor';

function contextFor(query: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        path: '/discovery/partners',
        query,
      }),
    }),
  } as never;
}

describe('NearbySearchIntegrityInterceptor', () => {
  const interceptor = new NearbySearchIntegrityInterceptor();

  it('rejects a latitude without a longitude', () => {
    expect(() =>
      interceptor.intercept(contextFor({ latitude: '51.5' }), {
        handle: () => of([]),
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects a longitude without a latitude', () => {
    expect(() =>
      interceptor.intercept(contextFor({ longitude: '-0.1' }), {
        handle: () => of([]),
      }),
    ).toThrow(BadRequestException);
  });

  it('fails closed when spatial discovery degrades to rows without distance', async () => {
    const result$ = interceptor.intercept(
      contextFor({ latitude: '51.5', longitude: '-0.1' }),
      {
        handle: () => of([{ id: 'unscoped-user' }]),
      },
    );

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('preserves distance while redacting coordinate-shaped fields', async () => {
    const result$ = interceptor.intercept(
      contextFor({ latitude: '51.5', longitude: '-0.1' }),
      {
        handle: () =>
          of([
            {
              id: 'nearby-user',
              display_name: 'A',
              distance_metres: 1532,
              latitude: 51.51,
              longitude: -0.11,
              location_latitude: 51.51,
            },
          ]),
      },
    );

    await expect(firstValueFrom(result$)).resolves.toEqual([
      { id: 'nearby-user', display_name: 'A', distance_metres: 1532 },
    ]);
  });

  it('does not interfere with non-spatial discovery', async () => {
    const result$ = interceptor.intercept(contextFor({}), {
      handle: () => of([{ id: 'normal-user' }]),
    });

    await expect(firstValueFrom(result$)).resolves.toEqual([{ id: 'normal-user' }]);
  });
});
