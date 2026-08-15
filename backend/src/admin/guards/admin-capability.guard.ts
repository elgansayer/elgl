import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@supabase/supabase-js';
import { Request } from 'express';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminCapability } from '../admin-capabilities';
import { ADMIN_CAPABILITIES_METADATA_KEY } from '../decorators/require-admin-capabilities.decorator';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class AdminCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AdminAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const required =
      this.reflector.getAllAndOverride<AdminCapability[]>(
        ADMIN_CAPABILITIES_METADATA_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (required.length === 0) {
      return true;
    }

    const allowed = await this.authorization.hasAllCapabilities(
      user.id,
      required,
    );
    if (!allowed) {
      throw new ForbiddenException('Required admin capability missing');
    }

    return true;
  }
}
