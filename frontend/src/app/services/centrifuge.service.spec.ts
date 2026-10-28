import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UnauthorizedError } from 'centrifuge';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

interface MockSubscriptionOptions {
  getToken?: () => Promise<string>;
}

class MockSubscription {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  subscribe = vi.fn();
  unsubscribe = vi.fn();
  publish = vi.fn().mockReturnValue(Promise.resolve());

  on(event: string, cb: (...args: unknown[]) => void): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(cb);
    this.listeners.set(event, existing);
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  emit(event: string, ctx: unknown): void {
    for (const cb of this.listeners.get(event) ?? []) {
      cb(ctx);
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

class MockCentrifuge {
  state = 'connected';
  connect = vi.fn(() => {
    this.state = 'connecting';
  });
  disconnect = vi.fn(() => {
    this.state = 'disconnected';
  });
  publish = vi.fn().mockResolvedValue(undefined);
  private readonly subs = new Map<string, MockSubscription>();
  private readonly subscriptionOptions = new Map<string, MockSubscriptionOptions | undefined>();
  private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  on(event: string, cb: (...args: unknown[]) => void): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(cb);
    this.listeners.set(event, existing);
    return this;
  }

  emit(event: string, ctx: unknown = {}): void {
    for (const cb of this.listeners.get(event) ?? []) {
      cb(ctx);
    }
  }

  newSubscription(channel: string, options?: MockSubscriptionOptions): MockSubscription {
    const sub = new MockSubscription();
    this.subs.set(channel, sub);
    this.subscriptionOptions.set(channel, options);
    return sub;
  }

  getSubscription(channel: string): MockSubscription | undefined {
    return this.subs.get(channel);
  }

  getSubscriptionOptions(channel: string): MockSubscriptionOptions | undefined {
    return this.subscriptionOptions.get(channel);
  }
}

class MockAuthService {
  getAccessToken = vi.fn().mockReturnValue('token');
}

describe('CentrifugeService', () => {
  const ROOM_ID = '11111111-1111-4111-8111-111111111111';

  let service: CentrifugeService;
  let httpMock: HttpTestingController;
  let mockCentrifuge: MockCentrifuge;
  let authService: MockAuthService;

  function subscriptionTokenFetcher(channel: string): () => Promise<string> {
    const getToken = mockCentrifuge.getSubscriptionOptions(channel)?.getToken;
    if (!getToken) {
      throw new Error(`Expected ${channel} to use a subscription token`);
    }
    return getToken;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CentrifugeService, { provide: AuthService, useClass: MockAuthService }],
    }).compileComponents();

    service = TestBed.inject(CentrifugeService);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as unknown as MockAuthService;

    mockCentrifuge = new MockCentrifuge();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = mockCentrifuge;
  });

  afterEach(() => {
    service.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
    httpMock.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('does not stack duplicate publication handlers when re-subscribing to the same channel', () => {
    const first = vi.fn();
    const second = vi.fn();

    const sub = service.subscribe('chat:room-1', first) as unknown as MockSubscription;
    service.subscribe('chat:room-1', second);

    expect(sub.listenerCount('publication')).toBe(1);

    sub.emit('publication', { data: { hello: 'world' } });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ hello: 'world' }, {});
  });

  it('only calls the message handler once per publication', () => {
    const handler = vi.fn();
    const sub = service.subscribe('chat:room-1', handler) as unknown as MockSubscription;

    sub.emit('publication', { data: 'first' });
    sub.emit('publication', { data: 'second' });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls).toEqual([
      ['first', {}],
      ['second', {}],
    ]);
  });

  describe('publisher identity', () => {
    it('reports the authenticated publisher of a client-published message', () => {
      const handler = vi.fn();
      const sub = service.subscribe('chat:room-1:typing', handler) as unknown as MockSubscription;

      sub.emit('publication', {
        data: { typing: true },
        info: { client: 'client-1', user: 'user-2' },
      });

      expect(handler).toHaveBeenCalledWith({ typing: true }, { publisherId: 'user-2' });
    });

    it('reports no publisher for server-API publications and anonymous connections', () => {
      const handler = vi.fn();
      const sub = service.subscribe('chat:room-1', handler) as unknown as MockSubscription;

      sub.emit('publication', { data: 'server' });
      sub.emit('publication', { data: 'anonymous', info: { client: 'client-9', user: '' } });

      expect(handler.mock.calls).toEqual([
        ['server', {}],
        ['anonymous', {}],
      ]);
    });

    it('keeps reporting the publisher after the client is replaced and subscriptions are restored', () => {
      const handler = vi.fn();
      service.subscribe('chat:room-1:typing', handler);

      const replacement = new MockCentrifuge();
      (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = replacement;
      (service as unknown as { restoreSubscriptions: () => void }).restoreSubscriptions();

      replacement
        .getSubscription('chat:room-1:typing')
        ?.emit('publication', { data: 'again', info: { client: 'c', user: 'user-3' } });

      expect(handler).toHaveBeenCalledWith('again', { publisherId: 'user-3' });
    });
  });

  it('keeps desired subscriptions while no client exists and restores them on a new client', () => {
    const handler = vi.fn();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = null;

    expect(service.subscribe('chat:room-1', handler)).toBeNull();

    const replacement = new MockCentrifuge();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = replacement;
    (service as unknown as { restoreSubscriptions: () => void }).restoreSubscriptions();

    const restored = replacement.getSubscription('chat:room-1');
    expect(restored).toBeDefined();
    expect(restored?.subscribe).toHaveBeenCalledOnce();

    restored?.emit('publication', { data: 'restored' });
    expect(handler).toHaveBeenCalledWith('restored', {});
  });

  it('rebuilds active subscriptions with the latest handler when the client is replaced', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const staleSubscription = service.subscribe(
      'chat:room-1',
      first,
    ) as unknown as MockSubscription;
    service.subscribe('chat:room-1', latest);

    const replacement = new MockCentrifuge();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = replacement;
    (service as unknown as { restoreSubscriptions: () => void }).restoreSubscriptions();

    expect(staleSubscription.unsubscribe).toHaveBeenCalledOnce();
    const restored = replacement.getSubscription('chat:room-1');
    restored?.emit('publication', { data: 'after-reconnect' });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith('after-reconnect', {});
  });

  it('does not restore a channel after it has been unsubscribed', () => {
    service.subscribe('chat:room-1', vi.fn());
    service.unsubscribe('chat:room-1');

    const replacement = new MockCentrifuge();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = replacement;
    (service as unknown as { restoreSubscriptions: () => void }).restoreSubscriptions();

    expect(replacement.getSubscription('chat:room-1')).toBeUndefined();
  });

  describe('chat subscription authorisation', () => {
    it('mints a message-stream token with the current authenticated session', async () => {
      const channel = `chat:${ROOM_ID}`;
      service.subscribe(channel, vi.fn());

      const tokenPromise = subscriptionTokenFetcher(channel)();
      const request = httpMock.expectOne(`${environment.apiUrl}/chat/subscriptions/token`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ room_id: ROOM_ID, stream: 'messages' });
      expect(request.request.headers.get('Authorization')).toBe('Bearer token');
      request.flush({ token: '  message-subscription-token  ' });

      await expect(tokenPromise).resolves.toBe('message-subscription-token');
    });

    it('requests a separate token contract for the typing stream', async () => {
      const channel = `chat:${ROOM_ID}:typing`;
      service.subscribe(channel, vi.fn());

      const tokenPromise = subscriptionTokenFetcher(channel)();
      const request = httpMock.expectOne(`${environment.apiUrl}/chat/subscriptions/token`);
      expect(request.request.body).toEqual({ room_id: ROOM_ID, stream: 'typing' });
      request.flush({ token: 'typing-subscription-token' });

      await expect(tokenPromise).resolves.toBe('typing-subscription-token');
    });

    it('does not attach the private chat token flow to unrelated channels', () => {
      service.subscribe('notifications:user-1', vi.fn());

      expect(mockCentrifuge.getSubscriptionOptions('notifications:user-1')).toBeUndefined();
      httpMock.expectNone(`${environment.apiUrl}/chat/subscriptions/token`);
    });

    it('rejects token refresh without an authenticated session before making a request', async () => {
      const channel = `chat:${ROOM_ID}`;
      authService.getAccessToken.mockReturnValue(null);
      service.subscribe(channel, vi.fn());

      await expect(subscriptionTokenFetcher(channel)()).rejects.toBeInstanceOf(UnauthorizedError);
      httpMock.expectNone(`${environment.apiUrl}/chat/subscriptions/token`);
    });

    it('turns a forbidden room response into a terminal subscription error', async () => {
      const channel = `chat:${ROOM_ID}`;
      service.subscribe(channel, vi.fn());

      const tokenPromise = subscriptionTokenFetcher(channel)();
      httpMock
        .expectOne(`${environment.apiUrl}/chat/subscriptions/token`)
        .flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

      await expect(tokenPromise).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('preserves transient server failures so Centrifuge can retry them', async () => {
      const channel = `chat:${ROOM_ID}`;
      service.subscribe(channel, vi.fn());

      const tokenPromise = subscriptionTokenFetcher(channel)();
      httpMock
        .expectOne(`${environment.apiUrl}/chat/subscriptions/token`)
        .flush({ message: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' });

      await expect(tokenPromise).rejects.toMatchObject({ status: 503 });
    });
  });

  it('does not request a Centrifugo token without an authenticated access token', async () => {
    authService.getAccessToken.mockReturnValue(null);
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = null;

    await service.connect();

    httpMock.expectNone(`${environment.apiUrl}/chat/token`);
    expect(service.isConnected()).toBe(false);
    expect(service.connectionStatus()).toBe('disconnected');
  });

  it('deduplicates concurrent connection initialisation and token requests', async () => {
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = null;
    const replacement = new MockCentrifuge();
    replacement.state = 'disconnected';
    const createClient = vi.fn().mockReturnValue(replacement);
    (service as unknown as { createClient: typeof createClient }).createClient = createClient;

    const first = service.connect();
    const second = service.connect();

    const request = httpMock.expectOne(`${environment.apiUrl}/chat/token`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    request.flush({ token: '  connection-token  ' });

    await Promise.all([first, second]);

    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith('connection-token');
    expect(replacement.connect).toHaveBeenCalledOnce();
  });

  it('uses the current auth session when refreshing a connection token', async () => {
    const tokenFetcher = service as unknown as { fetchConnectionToken: () => Promise<string> };

    const first = tokenFetcher.fetchConnectionToken();
    const firstRequest = httpMock.expectOne(`${environment.apiUrl}/chat/token`);
    expect(firstRequest.request.headers.get('Authorization')).toBe('Bearer token');
    firstRequest.flush({ token: 'centrifugo-one' });
    await expect(first).resolves.toBe('centrifugo-one');

    authService.getAccessToken.mockReturnValue('new-supabase-token');
    const second = tokenFetcher.fetchConnectionToken();
    const secondRequest = httpMock.expectOne(`${environment.apiUrl}/chat/token`);
    expect(secondRequest.request.headers.get('Authorization')).toBe('Bearer new-supabase-token');
    secondRequest.flush({ token: 'centrifugo-two' });
    await expect(second).resolves.toBe('centrifugo-two');
  });

  it('ignores a token response that completes after an intentional disconnect', async () => {
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = null;
    const createClient = vi.fn();
    (service as unknown as { createClient: typeof createClient }).createClient = createClient;

    const connecting = service.connect();
    const request = httpMock.expectOne(`${environment.apiUrl}/chat/token`);

    service.disconnect();
    request.flush({ token: 'stale-connection-token' });
    await connecting;

    expect(createClient).not.toHaveBeenCalled();
    expect(service.isConnected()).toBe(false);
    expect(service.connectionStatus()).toBe('disconnected');
  });

  it('exposes connecting, connected and reconnecting states from the client lifecycle', async () => {
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = null;
    const replacement = new MockCentrifuge();
    replacement.state = 'disconnected';
    (service as unknown as { createClient: () => MockCentrifuge }).createClient = () => replacement;

    const connecting = service.connect();
    expect(service.connectionStatus()).toBe('connecting');
    httpMock.expectOne(`${environment.apiUrl}/chat/token`).flush({ token: 'connection-token' });
    await connecting;

    replacement.state = 'connected';
    replacement.emit('connected');
    expect(service.isConnected()).toBe(true);
    expect(service.connectionStatus()).toBe('connected');

    replacement.state = 'connecting';
    replacement.emit('connecting');
    expect(service.isConnected()).toBe(false);
    expect(service.connectionStatus()).toBe('reconnecting');
  });

  it('honours Retry-After when the initial connection token endpoint rate limits', async () => {
    vi.useFakeTimers();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = null;

    const connecting = service.connect();
    httpMock.expectOne(`${environment.apiUrl}/chat/token`).flush(
      { message: 'rate limited' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '2' },
      },
    );
    await connecting;

    expect(service.connectionStatus()).toBe('rate-limited');
    await vi.advanceTimersByTimeAsync(1_999);
    httpMock.expectNone(`${environment.apiUrl}/chat/token`);

    await vi.advanceTimersByTimeAsync(1);
    httpMock.expectOne(`${environment.apiUrl}/chat/token`).flush({ token: 'retry-token' });
    await Promise.resolve();
  });

  it('cancels scheduled reconnects and blocks new ones after an intentional disconnect', async () => {
    vi.useFakeTimers();
    const reconnect = service as unknown as {
      scheduleReconnect: (delay?: number) => void;
    };

    reconnect.scheduleReconnect(100);
    service.disconnect();
    reconnect.scheduleReconnect(100);

    await vi.advanceTimersByTimeAsync(500);

    httpMock.expectNone(`${environment.apiUrl}/chat/token`);
    expect(mockCentrifuge.disconnect).toHaveBeenCalledOnce();
    expect(service.isConnected()).toBe(false);
    expect(service.connectionStatus()).toBe('disconnected');
  });
});
