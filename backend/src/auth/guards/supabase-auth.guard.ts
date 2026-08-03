import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: { id: string; email?: string };
    }>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token =
      typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : '';
    try {
      const authResult = await this.supabaseService
        .getClient()
        .auth.getUser(token);
      const authUser = authResult?.data?.user;
      if (!authUser) {
        throw new UnauthorizedException('Invalid token');
      }

      request.user = {
        id: authUser.id,
        email: authUser.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
