import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface MessageLikeRecord extends Record<string, unknown> {
  room_id?: unknown;
  sender_id?: unknown;
  expires_at?: unknown;
}

@Injectable()
export class DisappearingMessagesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
    }>();
    const url = request?.originalUrl ?? request?.url ?? '';

    if (!url.startsWith('/chat')) {
      return next.handle();
    }

    return next.handle().pipe(map((value) => this.filterExpired(value)));
  }

  private filterExpired(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value
        .filter((item) => !this.isExpiredMessage(item))
        .map((item) => this.filterExpired(item));
    }

    if (!this.isRecord(value)) {
      return value;
    }

    if (this.isExpiredMessage(value)) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.filterExpired(item)]),
    );
  }

  private isExpiredMessage(value: unknown): value is MessageLikeRecord {
    if (!this.isRecord(value)) {
      return false;
    }

    // Only records with the core chat-message shape are subject to retention.
    // This prevents unrelated chat response objects with an expires_at field
    // from being altered by the interceptor.
    if (typeof value.room_id !== 'string' || typeof value.sender_id !== 'string') {
      return false;
    }

    if (typeof value.expires_at !== 'string' || value.expires_at.length === 0) {
      return false;
    }

    const expiryMs = Date.parse(value.expires_at);
    return Number.isFinite(expiryMs) && expiryMs <= Date.now();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
