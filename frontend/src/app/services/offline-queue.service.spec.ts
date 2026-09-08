import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import type { ChatMessage } from './chat.service';
import { OfflineQueueService } from './offline-queue.service';

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let currentUser: ReturnType<typeof signal<{ id: string } | null>>;
  let originalIndexedDB: IDBFactory | undefined;

  const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: '4d83362d-829e-4a68-b7bd-941076fb71f3',
    room_id: 'room-1',
    sender_id: 'user-a',
    message_type: 'text',
    text_content: 'queued text',
    is_read: false,
    created_at: '2026-08-27T04:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    originalIndexedDB = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });

    currentUser = signal<{ id: string } | null>(null);
    TestBed.configureTestingModule({
      providers: [
        OfflineQueueService,
        {
          provide: AuthService,
          useValue: { currentUser },
        },
      ],
    });
    service = TestBed.inject(OfflineQueueService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: originalIndexedDB,
    });
  });

  it('does not expose queued content while signed out', async () => {
    await expect(service.getQueuedMessages()).resolves.toEqual([]);
  });

  it('fails closed instead of pretending a message was queued without a session', async () => {
    await expect(service.enqueueMessage(message())).rejects.toThrow(
      'Sign in before queueing an offline message',
    );
  });

  it('fails closed when IndexedDB is unavailable so callers can retain the draft', async () => {
    currentUser.set({ id: 'user-a' });
    TestBed.flushEffects();

    await expect(service.enqueueMessage(message())).rejects.toThrow(
      'Offline message storage is unavailable',
    );
  });

  it('rejects a queued message owned by a different account', () => {
    const validator = (
      service as unknown as {
        assertQueueableMessage(value: ChatMessage, ownerId: string): void;
      }
    ).assertQueueableMessage.bind(service);

    expect(() => validator(message({ sender_id: 'user-b' }), 'user-a')).toThrow(
      'Offline message does not belong to the authenticated account',
    );
  });

  it('rejects malformed identifiers and creation timestamps before persistence', () => {
    const validator = (
      service as unknown as {
        assertQueueableMessage(value: ChatMessage, ownerId: string): void;
      }
    ).assertQueueableMessage.bind(service);

    expect(() => validator(message({ id: '' }), 'user-a')).toThrow(
      'Offline message is missing required identifiers',
    );
    expect(() => validator(message({ room_id: '  ' }), 'user-a')).toThrow(
      'Offline message is missing required identifiers',
    );
    expect(() => validator(message({ created_at: 'not-a-date' }), 'user-a')).toThrow(
      'Offline message has an invalid creation timestamp',
    );
  });

  it('accepts a valid message belonging to the authenticated owner', () => {
    const validator = (
      service as unknown as {
        assertQueueableMessage(value: ChatMessage, ownerId: string): void;
      }
    ).assertQueueableMessage.bind(service);

    expect(() => validator(message(), 'user-a')).not.toThrow();
  });
});
