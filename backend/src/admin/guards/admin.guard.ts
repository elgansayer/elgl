import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { AdminAuditService } from '../admin-audit.service';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminCapability } from '../admin-capabilities';

type AuthenticatedRequest = {
  user?: User;
  method?: string;
  baseUrl?: string;
  path?: string;
  route?: { path?: string };
  headers?: Record<string, string | string[] | undefined>;
};

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly audit: AdminAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    let capabilities: AdminCapability[];
    try {
      capabilities = await this.authorization.getEffectiveCapabilities(user.id);
    } catch (error) {
      await this.recordDeniedOrFailed(request, user.id, 'failed');
      throw error;
    }

    if (capabilities.length === 0) {
      await this.recordDeniedOrFailed(request, user.id, 'denied');
      throw new ForbiddenException('Admin privileges required');
    }

    return true;
  }

  private async recordDeniedOrFailed(
    request: AuthenticatedRequest,
    actorUserId: string,
    outcome: 'denied' | 'failed',
  ): Promise<void> {
    const requestId = request.headers?.['x-request-id'];
    const rawCorrelationId = Array.isArray(requestId)
      ? requestId[0]
      : requestId;
    const correlationId =
      typeof rawCorrelationId === 'string' &&
      SAFE_CORRELATION_ID.test(rawCorrelationId)
        ? rawCorrelationId
        : undefined;
    const routePath = request.route?.path ?? request.path ?? '';
    const actionPath = `${request.baseUrl ?? ''}${routePath}`;
    const actionMethod = request.method?.toLowerCase() ?? 'request';
    const action = `${actionMethod} ${actionPath}`.slice(0, 160);

    try {
      await this.audit.record({
        actorUserId,
        action,
        targetType: 'admin-resource',
        outcome,
        correlationId,
        metadata: {
          source: 'admin-guard',
          operation:
            outcome === 'denied' ? 'admin-entry-denied' : 'admin-rbac-failed',
        },
      });
    } catch {
      // AdminAuditService logs a sanitized persistence failure. Never turn an
      // audit outage into authorization success.
    }
  }
}
