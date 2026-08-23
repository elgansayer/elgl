import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@supabase/supabase-js';
import { AdminAuditService } from '../admin-audit.service';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminCapability } from '../admin-capabilities';
import { ADMIN_CAPABILITIES_METADATA_KEY } from '../decorators/require-admin-capabilities.decorator';

type AuthenticatedRequest = {
  user?: User;
  method?: string;
  baseUrl?: string;
  path?: string;
  route?: { path?: string };
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | string[] | undefined>;
};

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_TARGET_ID = /^[A-Za-z0-9_-]{1,200}$/;

@Injectable()
export class AdminCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AdminAuthorizationService,
    private readonly audit: AdminAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const required =
      this.reflector.getAllAndOverride<AdminCapability[]>(
        ADMIN_CAPABILITIES_METADATA_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (required.length === 0) {
      return true;
    }

    let allowed: boolean;
    try {
      allowed = await this.authorization.hasAllCapabilities(user.id, required);
    } catch (error) {
      await this.recordOutcome(request, user.id, required[0], 'failed');
      throw error;
    }

    if (!allowed) {
      await this.recordOutcome(request, user.id, required[0], 'denied');
      throw new ForbiddenException('Required admin capability missing');
    }

    return true;
  }

  private async recordOutcome(
    request: AuthenticatedRequest,
    actorUserId: string,
    capabilityKey: AdminCapability | undefined,
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
    const rawTargetId = request.params?.id ?? request.params?.blockId;
    const candidateTargetId = Array.isArray(rawTargetId)
      ? rawTargetId[0]
      : rawTargetId;
    const targetId =
      typeof candidateTargetId === 'string' &&
      SAFE_TARGET_ID.test(candidateTargetId)
        ? candidateTargetId
        : undefined;
    const actionPath = `${request.baseUrl ?? ''}${routePath}`;

    try {
      await this.audit.record({
        actorUserId,
        action: `${request.method?.toLowerCase() ?? 'request'} ${actionPath}`.slice(
          0,
          160,
        ),
        capabilityKey,
        targetType: targetId ? 'admin-resource' : undefined,
        targetId,
        outcome,
        correlationId,
        metadata: {
          source: 'admin-capability-guard',
          operation:
            outcome === 'denied'
              ? 'capability-denied'
              : 'capability-check-failed',
        },
      });
    } catch {
      // AdminAuditService already emits a sanitized persistence failure. Access
      // remains fail-closed even when the audit store is unavailable.
    }
  }
}
