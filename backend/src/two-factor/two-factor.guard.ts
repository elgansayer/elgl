import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
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
    const token: string | undefined = request.headers['x-2fa-token'];
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
}
