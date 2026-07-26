import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (error || !data?.is_admin) {
      throw new ForbiddenException('Admin privileges required');
    }

    return true;
  }
}
