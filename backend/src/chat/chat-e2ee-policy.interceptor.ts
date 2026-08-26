import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatE2eeService } from './chat-e2ee.service';

interface AuthenticatedRequest {
  method?: string;
  path?: string;
  originalUrl?: string;
  user?: { id?: string };
  body?: { room_id?: unknown };
}

@Injectable()
export class ChatE2eePolicyInterceptor implements NestInterceptor {
  constructor(private readonly chatE2eeService: ChatE2eeService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const path = request.path ?? request.originalUrl ?? '';
    if (
      request.method === 'POST' &&
      /\/chat\/messages(?:\?|$)/.test(path) &&
      !path.includes('/chat/e2ee/') &&
      typeof request.user?.id === 'string' &&
      typeof request.body?.room_id === 'string'
    ) {
      await this.chatE2eeService.assertLegacyMessageAllowed(
        request.body.room_id,
        request.user.id,
      );
    }

    return next.handle();
  }
}
