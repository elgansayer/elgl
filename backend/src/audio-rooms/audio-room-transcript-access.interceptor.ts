import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { AudioRoomArchivesService } from './audio-room-archives.service';

interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

/**
 * Compatibility protection for the legacy GET /audio-rooms/:id/transcript
 * endpoint. The existing controller predates participant-scoped archives and
 * uses the service-role Supabase client, so database RLS alone cannot protect
 * that endpoint. This interceptor executes after guards and enforces the same
 * participant check as the new archive API without duplicating controller code.
 */
@Injectable()
export class AudioRoomTranscriptAccessInterceptor implements NestInterceptor {
  constructor(private readonly archives: AudioRoomArchivesService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.method !== 'GET') return next.handle();

    const path = request.path || request.url.split('?')[0];
    const match = path.match(/\/audio-rooms\/([^/]+)\/transcript\/?$/);
    if (!match) return next.handle();

    const userId = request.user?.id;
    if (userId) {
      await this.archives.assertCanAccess(userId, decodeURIComponent(match[1]));
    }
    return next.handle();
  }
}
