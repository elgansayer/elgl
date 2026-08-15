import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { AdminAuthorizationService } from '../admin-authorization.service';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authorization: AdminAuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const capabilities = await this.authorization.getEffectiveCapabilities(
      user.id,
    );
    if (capabilities.length === 0) {
      throw new ForbiddenException('Admin privileges required');
    }

    return true;
  }
}
