import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { AuthenticatedRequest } from './authenticated-request.interface';

interface AuthenticatedWsClient {
  user?: User;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | null => {
    const contextType = ctx.getType();
    if (contextType === 'http') {
      const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
      return request.user ?? null;
    }
    if (contextType === 'ws') {
      const client = ctx.switchToWs().getClient<AuthenticatedWsClient>();
      return client.user ?? null;
    }
    return null;
  },
);
