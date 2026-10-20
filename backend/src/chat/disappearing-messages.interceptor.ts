import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface MessageLikeRecord extends Record<string, unknown> {
  id?: unknown;
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

    // Supports both direct controller paths (/chat/...) and applications using
    // a global prefix (/api/chat/...). Do not touch responses outside Chat.
    if (!/(?:^|\/)chat(?:\/|$)/.test(url)) {
      return next.handle();
    }

    const stripLegacyMessageMocks = /(?:^|\/)chat\/(?:messages|search)(?:\/|\?|$)/.test(url);
    return next
      .handle()
      .pipe(map((value) => this.filterExpired(value, stripLegacyMessageMocks)));
  }

  private filterExpired(value: unknown, stripLegacyMessageMocks: boolean): unknown {
    if (Array.isArray(value)) {
      return value
        .filter(
          (item) =>
            !this.isExpiredMessage(item) &&
            !this.containsExpiredFavouriteSnapshot(item) &&
            !(stripLegacyMessageMocks && this.isLegacySyntheticMessage(item)),
        )
        .map((item) => this.filterExpired(item, stripLegacyMessageMocks));
    }

    if (!this.isRecord(value)) {
      return value;
    }

    if (
      this.isExpiredMessage(value) ||
      this.containsExpiredFavouriteSnapshot(value) ||
      (stripLegacyMessageMocks && this.isLegacySyntheticMessage(value))
    ) {
      return null;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        this.filterExpired(item, stripLegacyMessageMocks),
      ]),
    );
  }

  private containsExpiredFavouriteSnapshot(value: unknown): boolean {
    return (
      this.isRecord(value) &&
      value['item_type'] === 'message' &&
      this.isExpiredMessage(value['item_payload'])
    );
  }

  private isLegacySyntheticMessage(value: unknown): boolean {
    return (
      this.isRecord(value) &&
      typeof value['id'] === 'string' &&
      value['id'].startsWith('mock-msg-') &&
      typeof value['room_id'] === 'string' &&
      typeof value['sender_id'] === 'string'
    );
  }

  private isExpiredMessage(value: unknown): value is MessageLikeRecord {
    if (!this.isRecord(value)) {
      return false;
    }

    // Only records with the core chat-message shape are subject to retention.
    // This prevents unrelated chat response objects with an expires_at field
    // from being altered by the interceptor.
    if (typeof value['room_id'] !== 'string' || typeof value['sender_id'] !== 'string') {
      return false;
    }

    if (typeof value['expires_at'] !== 'string' || value['expires_at'].length === 0) {
      return false;
    }

    const expiryMs = Date.parse(value['expires_at']);
    return Number.isFinite(expiryMs) && expiryMs <= Date.now();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
