import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { Request, Response } from 'express';
import { Observable, from, map, switchMap } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProfileVisitor } from '../interfaces/user-profile.interface';

interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Compatibility boundary for the deprecated GET /users/me/visitors endpoint.
 *
 * New clients use /profile-visits/my-visitors. Until the legacy route is
 * removed, this interceptor prevents it from bypassing the VIP identity gate.
 */
@Injectable()
export class LegacyProfileVisitorsPrivacyInterceptor implements NestInterceptor {
  constructor(private readonly supabaseService: SupabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!this.isLegacyVisitorsRequest(request)) return next.handle();

    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Deprecation', 'true');
    response.setHeader(
      'Link',
      '</profile-visits/my-visitors>; rel="successor-version"',
    );

    if (!request.user) return next.handle();

    return from(this.canSeeVisitorIdentity(request.user.id)).pipe(
      switchMap((identityVisible) =>
        next
          .handle()
          .pipe(
            map((value: unknown) =>
              identityVisible ? value : this.maskLegacyVisitorPayload(value),
            ),
          ),
      ),
    );
  }

  private isLegacyVisitorsRequest(request: Request): boolean {
    return (
      request.method === 'GET' && request.path.endsWith('/users/me/visitors')
    );
  }

  private async canSeeVisitorIdentity(userId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('is_vip, is_deleted, scheduled_for_deletion_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new ServiceUnavailableException(
        'Unable to verify visitor-log entitlement',
      );
    }

    const row = data as {
      is_vip?: boolean | null;
      is_deleted?: boolean | null;
      scheduled_for_deletion_at?: string | null;
    };

    if (row.is_deleted || row.scheduled_for_deletion_at) return false;
    return Boolean(row.is_vip);
  }

  private maskLegacyVisitorPayload(value: unknown): unknown {
    if (!Array.isArray(value)) return [];

    return (value as ProfileVisitor[]).map((visit) => ({
      id: visit.id,
      visitor_id: 'hidden-vip-only',
      viewed_id: visit.viewed_id,
      created_at: visit.created_at,
      visitor: {
        id: 'hidden-vip-only',
        display_name: 'Someone viewed your profile',
        avatar_url: '',
        native_languages: [],
        target_languages: [],
      },
    }));
  }
}
