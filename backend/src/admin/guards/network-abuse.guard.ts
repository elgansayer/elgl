import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminNetworkAbuseService } from '../admin-network-abuse.service';
import {
  AdminNetworkProviderService,
  TrustedNetworkProviderContext,
} from '../admin-network-provider.service';
import { AdminNetworkBlockScope } from '../dto/admin-network-abuse.dto';

@Injectable()
export class NetworkAbuseGuard implements CanActivate {
  constructor(
    private readonly networkAbuse: AdminNetworkAbuseService,
    private readonly providerAbuse: AdminNetworkProviderService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request || this.isExemptPath(request.path)) return true;

    const scope = this.requestScope(request);
    const provider = this.providerContext(request);
    if (provider && scope !== 'all') {
      // Aggregation failures are swallowed by the service and never block a user request.
      void this.providerAbuse.recordSignal(provider, scope);
    }

    const [ipBlocked, providerBlocked] = await Promise.all([
      this.networkAbuse.isRequestBlocked(this.clientIp(request), scope),
      this.providerAbuse.isRequestBlocked(provider?.asn, scope),
    ]);
    if (!ipBlocked && !providerBlocked) return true;

    throw new ForbiddenException(
      'This network is temporarily restricted. Retry later or contact support if this is unexpected.',
    );
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
      const value = this.header(request, 'cf-connecting-ip');
      if (value) return value;
    }
    return request.ip || request.socket?.remoteAddress;
  }

  private providerContext(
    request: Request,
  ): TrustedNetworkProviderContext | undefined {
    const trusted =
      process.env.TRUST_CLOUDFLARE_CONNECTING_IP === 'true' &&
      process.env.TRUST_CLOUDFLARE_NETWORK_METADATA === 'true';
    if (!trusted) return undefined;

    const rawAsn = this.header(request, 'x-elgl-client-asn');
    if (!rawAsn || !/^\d{1,10}$/.test(rawAsn)) return undefined;

    let asn: number;
    try {
      asn = this.providerAbuse.normalizeAsn(Number(rawAsn));
    } catch {
      return undefined;
    }

    const provider = this.providerAbuse.normalizeProvider(
      this.header(request, 'x-elgl-client-provider'),
    );
    const hosting = this.header(request, 'x-elgl-client-hosting');
    return {
      asn,
      provider,
      isHostingProvider: hosting === 'true',
    };
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' && first.trim() ? first.trim() : undefined;
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
