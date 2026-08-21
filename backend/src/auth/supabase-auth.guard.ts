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
      token = this.extractTokenFromHeader(request);
    } else if (contextType === 'ws') {
      const client = context.switchToWs().getClient<WsHandshakeClient>();
      targetObject = client;
      const authHeader = client.handshake?.headers?.authorization;
      token = authHeader
        ? authHeader.split(' ')[1]
        : client.handshake?.auth?.token;
    } else {
      throw new UnauthorizedException('Unsupported execution context');
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const supabase = this.supabaseService.getClient();
    const result = await supabase.auth.getUser(token);

    if (result.error || !result.data || !result.data.user) {
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

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
    return undefined;
  }
}
