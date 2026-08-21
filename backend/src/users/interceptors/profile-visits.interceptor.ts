import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { AuthenticatedRequest } from '../../auth/authenticated-request.interface';
import { ProfileVisitsService } from '../profile-visits.service';

@Injectable()
export class ProfileVisitsInterceptor implements NestInterceptor {
  constructor(private readonly profileVisitsService: ProfileVisitsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (
      context.getType() !== 'http' ||
      context.getHandler().name !== 'getUserProfile'
    ) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const visitorId = request.user?.id;
    const rawViewedId = request.params['id'];
    const viewedId = typeof rawViewedId === 'string' ? rawViewedId : undefined;

    if (!visitorId || !viewedId || visitorId === viewedId) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (response: unknown) => {
        await this.profileVisitsService.recordVisit(visitorId, viewedId);
        return response;
      }),
    );
  }
}
