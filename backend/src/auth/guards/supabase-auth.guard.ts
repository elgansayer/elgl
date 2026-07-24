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

    const token = (authHeader as string).replace('Bearer ', '');
    try {
      const {
        data: { user },
      } = await this.supabaseService.getClient().auth.getUser(token);

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      request.user = { id: user.id, email: user.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
