import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';

interface RequestWithUser {
  user?: { id: string };
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.extractRequest(context);

    const user = request.user;
    if (!user?.id) {
      throw new UnauthorizedException();
    }

    // If the user does not have 2FA enabled, allow the request.
    const enabled = await this.twoFactorService.isEnabled(user.id);
    if (!enabled) {
      return true;
    }

    // 2FA is enabled, require a valid token in the x-2fa-token header.
    const tokenHeader = request.headers['x-2fa-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!token) {
      throw new UnauthorizedException(
        'Two-factor authentication token required (x-2fa-token header)',
      );
    }

    const valid = await this.twoFactorService.verifyToken(user.id, token);
    if (!valid) {
      throw new UnauthorizedException(
        'Invalid two-factor authentication token',
      );
    }

    return true;
  }

  private extractRequest(context: ExecutionContext): RequestWithUser {
    const rawRequest: unknown = context.switchToHttp().getRequest();
    if (!this.isRequestWithUser(rawRequest)) {
      throw new UnauthorizedException();
    }
    return rawRequest;
  }

  private isRequestWithUser(value: unknown): value is RequestWithUser {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    if (!('headers' in value)) {
      return false;
    }

    const headers: unknown = value.headers;
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
      return false;
    }

    if ('user' in value) {
      const user = value.user;
      if (user === undefined || user === null) {
        return true;
      }

      if (typeof user !== 'object' || Array.isArray(user)) {
        return false;
      }

      if (!('id' in user)) {
        return false;
      }

      const id: unknown = user.id;
      if (typeof id !== 'string') {
        return false;
      }
    }

    return true;
  }
}
