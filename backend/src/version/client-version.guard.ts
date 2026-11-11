import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import {
  ALLOW_OUTDATED_CLIENT_KEY,
  CLIENT_VERSION_HEADER,
} from './client-version.constants';
import { UpgradeRequiredException } from './upgrade-required.exception';
import { VersionService } from './version.service';

/**
 * Global guard that rejects first-party clients whose declared build version is
 * below `MINIMUM_SUPPORTED_APP_VERSION` with HTTP 426.
 *
 * Fail-open by design: a request without the version header (webhooks, probes,
 * server-to-server callers, builds that predate the header) or with a value that
 * is not a semantic version is never rejected. The check is a compatibility
 * gate for clients that identify themselves, not an authentication boundary.
 */
@Injectable()
export class ClientVersionGuard implements CanActivate {
  private readonly logger = new Logger(ClientVersionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly versions: VersionService,
    private readonly metrics: MetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const mode = this.versions.getEnforcementMode();
    if (mode === 'off') {
      return true;
    }

    const allowOutdated = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_OUTDATED_CLIENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowOutdated) {
      return true;
    }

    const http = context.switchToHttp();
    const declared = this.readDeclaredVersion(http.getRequest<Request>());
    if (declared === undefined) {
      this.metrics.recordClientVersionCheck('missing');
      return true;
    }

    const evaluation = this.versions.evaluateClientVersion(declared);
    if (evaluation.status === 'unknown') {
      this.metrics.recordClientVersionCheck('invalid');
      return true;
    }
    if (evaluation.status !== 'upgrade_required') {
      this.metrics.recordClientVersionCheck('supported');
      return true;
    }

    if (mode === 'report-only') {
      this.metrics.recordClientVersionCheck('report_only');
      this.logger.debug({
        event: 'client_version_below_minimum_report_only',
        minimumSupported: evaluation.minimumSupported,
      });
      return true;
    }

    this.metrics.recordClientVersionCheck('upgrade_required');
    this.logger.debug({
      event: 'client_version_rejected',
      minimumSupported: evaluation.minimumSupported,
    });
    // A rejection reflects current policy and must not outlive a rollback.
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
    throw new UpgradeRequiredException({
      minimumSupported: evaluation.minimumSupported,
      updateUrl: evaluation.updateUrl,
    });
  }

  private readDeclaredVersion(request: Request): string | undefined {
    const raw = request.headers?.[CLIENT_VERSION_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }
}
