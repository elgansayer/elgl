import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, catchError, from, map, mergeMap, throwError } from 'rxjs';
import { AdminAuditService } from './admin-audit.service';
import { AdminCapability } from './admin-capabilities';
import { ADMIN_CAPABILITIES_METADATA_KEY } from './decorators/require-admin-capabilities.decorator';

type AdminMutationRequest = Request & {
  user?: { id?: string; sub?: string };
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Makes audit persistence part of the completion contract for administrative
 * mutations. Request bodies are never copied into audit metadata.
 */
@Injectable()
export class AdminMutationAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AdminMutationRequest>();
    const method = request.method.toUpperCase();
    const requestPath = `${request.baseUrl ?? ''}${request.path ?? ''}`;
    if (SAFE_METHODS.has(method) || !requestPath.includes('/admin')) {
      return next.handle();
    }

    const actorUserId = request.user?.id ?? request.user?.sub;
    if (!actorUserId) {
      throw new UnauthorizedException();
    }

    const capabilities =
      this.reflector.getAllAndOverride<AdminCapability[]>(
        ADMIN_CAPABILITIES_METADATA_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    const capabilityKey = capabilities[0];
    const requestId = request.headers['x-request-id'];
    const correlationId = Array.isArray(requestId) ? requestId[0] : requestId;
    const routePath = request.route?.path ?? request.path;
    const rawTargetId = request.params?.id ?? request.params?.blockId;
    const targetId = Array.isArray(rawTargetId) ? rawTargetId[0] : rawTargetId;
    const targetType = request.params?.blockId
      ? 'block'
      : targetId
        ? 'user'
        : 'admin-resource';
    const action =
      `${method.toLowerCase()} ${request.baseUrl}${routePath}`.slice(0, 160);

    const record = (outcome: 'success' | 'failed') =>
      this.audit.record({
        actorUserId,
        action,
        capabilityKey,
        targetType,
        targetId,
        outcome,
        correlationId,
        metadata: {
          source: 'admin-mutation-interceptor',
          operation: context.getHandler().name,
        },
      });

    return next.handle().pipe(
      mergeMap((value) => from(record('success')).pipe(map(() => value))),
      catchError((error: unknown) =>
        from(record('failed')).pipe(mergeMap(() => throwError(() => error))),
      ),
    );
  }
}
