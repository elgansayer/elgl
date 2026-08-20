import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

interface AuthenticatedRequest extends Request {
  user?: User;
}

interface WsHandshakeClient {
  handshake?: {
    headers?: {
      authorization?: string;
    };
    auth?: {
      token?: string;
    };
  };
  user?: User;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const contextType = context.getType();
    let token: string | undefined;
    let targetObject: AuthenticatedRequest | WsHandshakeClient;

    if (contextType === 'http') {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      targetObject = request;
      token = this.extractBearerToken(request.headers.authorization);
    } else if (contextType === 'ws') {
      const client = context.switchToWs().getClient<WsHandshakeClient>();
      targetObject = client;
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
      // Authentication must fail closed if the provider cannot validate the token.
      // Do not expose provider/network details or the supplied credential.
      throw new UnauthorizedException('Invalid or expired token');
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

  private extractBearerToken(authHeader: unknown): string | undefined {
    if (typeof authHeader !== 'string') {
      return undefined;
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
    return match?.[1];
  }

  private extractHandshakeToken(token: unknown): string | undefined {
    if (typeof token !== 'string') {
      return undefined;
    }

    const trimmed = token.trim();
    return trimmed.length > 0 && !/\s/.test(trimmed) ? trimmed : undefined;
  }
}
