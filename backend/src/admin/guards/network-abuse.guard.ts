import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminNetworkAbuseService } from '../admin-network-abuse.service';
import { AdminNetworkBlockScope } from '../dto/admin-network-abuse.dto';

@Injectable()
export class NetworkAbuseGuard implements CanActivate {
  constructor(private readonly networkAbuse: AdminNetworkAbuseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request || this.isExemptPath(request.path)) return true;

    const scope = this.requestScope(request);
    const blocked = await this.networkAbuse.isRequestBlocked(
      this.clientIp(request),
      scope,
    );
    if (!blocked) return true;

    throw new ForbiddenException(
      'This network is temporarily restricted. Retry later or contact support if this is unexpected.',
    );
  }

  private requestScope(request: Request): AdminNetworkBlockScope {
    if (/^\/auth(?:\/|$)/.test(request.path)) return 'auth';
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
      /^\/admin(?:\/|$)/.test(path) ||
      /^\/docs(?:\/|$)/.test(path) ||
      path === '/' ||
      path === '/health'
    );
  }
}
