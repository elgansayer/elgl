import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

interface AuthenticatedRequest extends Request {
  user?: { sub: string };
}

@Injectable()
export class StreakMiddleware implements NestMiddleware {
  private readonly logger = new Logger(StreakMiddleware.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Only update last_active_at for authenticated requests
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.sub;
    if (userId) {
      try {
        const supabase = this.supabaseService.getClient();
        await supabase
          .from('users')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', userId);
      } catch (error) {
        // Silently fail – streak tracking is non-critical
        this.logger.warn('Failed to update last_active_at', error);
      }
    }
    next();
  }
}
