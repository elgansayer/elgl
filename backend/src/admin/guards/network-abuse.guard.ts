import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminNetworkAbuseService } from '../admin-network-abuse.service';
import { AdminRateLimitControlService } from '../admin-rate-limit-control.service';
import { AdminNetworkBlockScope } from '../dto/admin-network-abuse.dto';

@Injectable()
export class NetworkAbuseGuard implements CanActivate {
  constructor(
    private readonly networkAbuse: AdminNetworkAbuseService,
    private readonly rateLimits: AdminRateLimitControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request || this.isExemptPath(request.path)) return true;

    const scope = this.requestScope(request);
    const ip = this.clientIp(request);
    const blocked = await this.networkAbuse.isRequestBlocked(ip, scope);
    if (blocked) {
      throw new ForbiddenException(
        'This network is temporarily restricted. Retry later or contact support if this is unexpected.',
      );
    }

    const throttle = await this.rateLimits.consume(ip, scope);
    if (throttle.limited) {
      const response = context.switchToHttp().getResponse<Response>();
      response.setHeader('Retry-After', String(throttle.retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'This network is temporarily rate limited. Retry after the indicated interval.',
          retryAfter: throttle.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private requestScope(request: Request): AdminNetworkBlockScope {
    if (/^\/(?:api\/)?auth(?:\/|$)/.test(request.path)) return 'auth';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) {
      return 'write';
    }
    return 'all';
  }

  private clientIp(request: Request): string | undefined {
    const trustCloudflare =
      process.env.TRUST_CLOUDFLARE_CONNECTING_IP === 'true';
    if (trustCloudflare) {
      const header = request.headers['cf-connecting-ip'];
      const value = Array.isArray(header) ? header[0] : header;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return request.ip || request.socket?.remoteAddress;
  }

  private isExemptPath(path: string): boolean {
    return (
      /^\/(?:api\/)?admin(?:\/|$)/.test(path) ||
      /^\/(?:api\/)?docs(?:\/|$)/.test(path) ||
      path === '/' ||
      /^\/(?:api\/)?health\/?$/.test(path)
    );
  }
}
