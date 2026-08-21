import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

const PARTNERS_PATH = '/discovery/partners';
const COORDINATE_KEYS = new Set([
  'latitude',
  'longitude',
  'lat',
  'lon',
  'location_latitude',
  'location_longitude',
]);

interface HttpRequestLike {
  method?: string;
  path?: string;
  url?: string;
  query?: Record<string, unknown>;
}

/**
 * Defence-in-depth for GPS Nearby discovery.
 *
 * The legacy discovery service deliberately degrades to non-spatial results
 * when PostGIS is unavailable. That is useful for normal discovery, but it is
 * unsafe for an explicit Nearby search because unrelated users would be shown
 * as if they were nearby. This interceptor makes the GPS contract fail closed
 * and strips any coordinate-shaped fields from proximity responses.
 */
@Injectable()
export class NearbySearchIntegrityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    if (!this.isPartnersRequest(request)) return next.handle();

    const query = request.query ?? {};
    const hasLatitude = query.latitude !== undefined && query.latitude !== '';
    const hasLongitude = query.longitude !== undefined && query.longitude !== '';

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('latitude and longitude must be supplied together');
    }
    if (!hasLatitude) return next.handle();

    return next.handle().pipe(
      map((body: unknown) => {
        if (!Array.isArray(body)) return body;

        if (body.some((item) => !this.hasFiniteDistance(item))) {
          throw new ServiceUnavailableException(
            'Nearby search is temporarily unavailable. Try again shortly.',
          );
        }

        return body.map((item) => this.redactCoordinates(item));
      }),
    );
  }

  private isPartnersRequest(request: HttpRequestLike): boolean {
    if ((request.method ?? 'GET').toUpperCase() !== 'GET') return false;
    const path = request.path ?? request.url?.split('?')[0] ?? '';
    return path === PARTNERS_PATH || path.endsWith(PARTNERS_PATH);
  }

  private hasFiniteDistance(item: unknown): boolean {
    if (!item || typeof item !== 'object') return false;
    const distance = (item as Record<string, unknown>).distance_metres;
    return typeof distance === 'number' && Number.isFinite(distance) && distance >= 0;
  }

  private redactCoordinates(item: unknown): unknown {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).filter(
        ([key]) => !COORDINATE_KEYS.has(key.toLowerCase()),
      ),
    );
  }
}
