import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { AuthenticatedRequest } from './authenticated-request.interface';
import { SupabaseService } from '../supabase/supabase.service';

type AuthorizationHeader = string | string[] | undefined;

interface WsHandshakeClient {
  handshake?: {
    headers?: {
      authorization?: AuthorizationHeader;
    };
    auth?: {
      token?: unknown;
    };
  };
  user?: User;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const contextType = context.getType();
    let token: string | undefined;
    let targetObject: AuthenticatedRequest | WsHandshakeClient;

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      targetObject = request;
      request.user = undefined;
      token = this.extractBearerToken(request.headers.authorization);
    } else if (contextType === 'ws') {
      const client = context.switchToWs().getClient<WsHandshakeClient>();
      targetObject = client;
      client.user = undefined;

      token =
        this.extractBearerToken(client.handshake?.headers?.authorization) ??
        this.extractHandshakeToken(client.handshake?.auth?.token);
    } else {
      throw new UnauthorizedException('Unsupported execution context');
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    let result: Awaited<
      ReturnType<ReturnType<SupabaseService['getClient']>['auth']['getUser']>
    >;

    try {
      const supabase = this.supabaseService.getClient();
      result = await supabase.auth.getUser(token);
    } catch {
      this.logger.warn('Supabase authentication verification unavailable');
      throw new UnauthorizedException('Unable to verify authentication token');
    }

    if (result.error || !result.data?.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = result.data.user;

    if (contextType === 'http') {
      const request = targetObject as AuthenticatedRequest;
      request.user = user;
    } else {
      const client = targetObject as WsHandshakeClient;
      client.user = user;
    }

    return true;
  }

  private extractBearerToken(header: AuthorizationHeader): string | undefined {
    if (typeof header !== 'string') {
      return undefined;
    }

    const match = /^\s*Bearer[\t ]+([^\s]+)\s*$/i.exec(header);
    return match?.[1];
  }

  private extractHandshakeToken(token: unknown): string | undefined {
    if (typeof token !== 'string') {
      return undefined;
    }

    const trimmed = token.trim();
    if (!trimmed || /\s/.test(trimmed)) {
      return undefined;
    }

    return trimmed;
  }
}
