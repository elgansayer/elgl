import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { ACCOUNT_SUSPENDED_CODE } from '../account-suspension/account-suspension.constants';
import { AccountSuspensionService } from '../account-suspension/account-suspension.service';
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

  constructor(
    private readonly supabaseService: SupabaseService,
    // Optional so feature-module test beds that never register the global
    // AccountSuspensionModule keep compiling; AppModule always provides it.
    @Optional() private readonly suspensions?: AccountSuspensionService,
  ) {}

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
    await this.assertNotSuspended(user.id);

    if (contextType === 'http') {
      const request = targetObject as AuthenticatedRequest;
      request.user = user;
    } else {
      const client = targetObject as WsHandshakeClient;
      client.user = user;
    }

    return true;
  }

  /**
   * Rejects an identity that an operator has suspended. The body carries only
   * the end time, so the client can explain the restriction without exposing the
   * internal reason or notes. The lookup fails open (see AccountSuspensionService).
   */
  private async assertNotSuspended(userId: string): Promise<void> {
    const active = await this.suspensions?.findActive(userId);
    if (!active) {
      return;
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'Forbidden',
      code: ACCOUNT_SUSPENDED_CODE,
      message: 'This account is temporarily suspended.',
      suspendedUntil: active.expiresAt,
    });
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
