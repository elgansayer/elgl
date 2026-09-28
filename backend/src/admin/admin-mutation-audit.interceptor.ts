import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, from, map, mergeMap, throwError } from 'rxjs';
import {
  ADMIN_ACTION_REASON_CODES,
  AdminActionReasonCode,
  normalizeAdminOperatorNote,
} from './admin-action-reasons';
import { AdminAuditService } from './admin-audit.service';
import { AdminCapability } from './admin-capabilities';
import { ADMIN_CAPABILITIES_METADATA_KEY } from './decorators/require-admin-capabilities.decorator';

type AdminRequest = {
  method: string;
  baseUrl?: string;
  path?: string;
  route?: { path?: string };
  user?: { id?: string; sub?: string };
  body?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  params?: Record<string, string | string[] | undefined>;
};

const ADMIN_PREFIX = '/admin';
const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]{1,200}$/;
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const ADMIN_REASON_CODES = new Set<string>(ADMIN_ACTION_REASON_CODES);
const USERS_PATH = /(?:^|\/)users(?:\/|$)/;

// These operations already produce richer, semantic audit events in their
// controllers. Keying by controller + handler is independent of global prefixes
// and Express router mounting, so the same operation is never double-audited.
const MANUALLY_AUDITED_HANDLERS = new Set([
  'AdminV1Controller.getSystemHealth',
  'AdminV1Controller.listAudit',
  'AdminV1Controller.listModerationReports',
  'AdminV1Controller.getUserLoginHistory',
  'AdminOperationalEventsV1Controller.list',
  'AdminNetworkAbuseV1Controller.lookup',
  'AdminNetworkAbuseV1Controller.impact',
  'AdminNetworkAbuseV1Controller.listBlocks',
  'AdminNetworkAbuseV1Controller.listAllowlist',
  'AdminNetworkAbuseV1Controller.createBlock',
  'AdminNetworkAbuseV1Controller.revokeBlock',
  'AdminNetworkAbuseV1Controller.createAllowlist',
  'AdminNetworkAbuseV1Controller.revokeAllowlist',
]);

/**
 * Audits every authenticated administrative request that is not explicitly
 * handled by a richer route-level audit. The historical class name is retained
 * to avoid an unnecessary provider migration, but this interceptor now covers
 * privileged reads as well as mutations.
 *
 * Request bodies, query strings, response payloads, credentials and arbitrary
 * headers are never copied into audit metadata.
 */
@Injectable()
export class AdminMutationAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const method = request.method.toUpperCase();
    const requestPath = `${request.baseUrl ?? ''}${request.path ?? ''}`;
    if (!requestPath.includes(ADMIN_PREFIX)) {
      return next.handle();
    }

    const actorUserId = request.user?.id ?? request.user?.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const handler = context.getHandler();
    const controller = context.getClass();
    const handlerKey = `${controller.name}.${handler.name}`;
    if (MANUALLY_AUDITED_HANDLERS.has(handlerKey)) {
      return next.handle();
    }

    const capabilities =
      this.reflector.getAllAndOverride<AdminCapability[]>(
        ADMIN_CAPABILITIES_METADATA_KEY,
        [handler, controller],
      ) ?? [];
    const capabilityKey = capabilities[0];
    const routePath = request.route?.path ?? request.path ?? '';

    const requestId = request.headers['x-request-id'];
    const rawCorrelationId = Array.isArray(requestId)
      ? requestId[0]
      : requestId;
    const correlationId =
      typeof rawCorrelationId === 'string' &&
      SAFE_CORRELATION_ID.test(rawCorrelationId)
        ? rawCorrelationId
        : undefined;

    const rawTargetId =
      request.params?.id ??
      request.params?.blockId ??
      request.params?.assignmentId ??
      request.params?.roleId;
    const candidateTargetId = Array.isArray(rawTargetId)
      ? rawTargetId[0]
      : rawTargetId;
    const targetId =
      typeof candidateTargetId === 'string' &&
      SAFE_IDENTIFIER.test(candidateTargetId)
        ? candidateTargetId
        : undefined;
    const targetType = this.resolveTargetType(request, targetId);
    const actionPath = `${request.baseUrl ?? ''}${routePath}`;
    const action = `${method.toLowerCase()} ${actionPath}`.slice(0, 160);

    const reasonCode = this.getReasonCode(request.body);
    // Validate the only free-text field before a mutation can run. This avoids
    // a successful state change followed by an audit failure caused by a note
    // containing an apparent credential or exceeding the audit limit.
    const operatorNote = normalizeAdminOperatorNote(
      typeof request.body?.operatorNote === 'string'
        ? request.body.operatorNote
        : undefined,
    );

    const record = (
      outcome: 'success' | 'failed',
      result?: unknown,
    ): Promise<void> =>
      this.audit.record({
        actorUserId,
        action,
        capabilityKey,
        targetType,
        targetId,
        reasonCode,
        operatorNote: operatorNote ?? undefined,
        outcome,
        correlationId,
        metadata: {
          source: 'admin-request-interceptor',
          operation: handler.name,
          resultCount: this.getResultCount(result),
        },
      });

    // Handle operation failures before the success-audit stage. This prevents
    // a failed success-audit write from being misclassified and retried as a
    // second "failed" audit event.
    return next.handle().pipe(
      catchError((error: unknown) =>
        from(record('failed')).pipe(mergeMap(() => throwError(() => error))),
      ),
      mergeMap((value) =>
        from(record('success', value)).pipe(map(() => value)),
      ),
    );
  }

  private getReasonCode(
    body: Record<string, unknown> | undefined,
  ): AdminActionReasonCode | undefined {
    const value = body?.reasonCode;
    return typeof value === 'string' && ADMIN_REASON_CODES.has(value)
      ? (value as AdminActionReasonCode)
      : undefined;
  }

  private resolveTargetType(request: AdminRequest, targetId?: string): string {
    if (request.params?.blockId) return 'block';
    if (request.params?.assignmentId) return 'role-assignment';
    if (request.params?.roleId) return 'admin-role';

    const resourcePath = `${request.baseUrl ?? ''}${request.path ?? ''}`;
    if (targetId && USERS_PATH.test(resourcePath)) {
      return 'user';
    }
    return 'admin-resource';
  }

  private getResultCount(result: unknown): number | undefined {
    if (Array.isArray(result)) return result.length;
    if (!result || typeof result !== 'object') return undefined;

    const candidate = result as Record<string, unknown>;
    for (const key of ['users', 'reports', 'blocks', 'events', 'roles']) {
      if (Array.isArray(candidate[key])) return candidate[key].length;
    }
    return undefined;
  }
}
