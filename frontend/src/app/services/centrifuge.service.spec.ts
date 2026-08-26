import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

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

  newSubscription(channel: string): MockSubscription {
    const sub = new MockSubscription();
    this.subs.set(channel, sub);
    return sub;
  }

  getSubscription(channel: string): MockSubscription | undefined {
    return this.subs.get(channel);
  }
}

class MockAuthService {
  getAccessToken = vi.fn().mockReturnValue('token');
}

describe('CentrifugeService', () => {
  let service: CentrifugeService;
  let httpMock: HttpTestingController;
  let mockCentrifuge: MockCentrifuge;
  let authService: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CentrifugeService,
        { provide: AuthService, useClass: MockAuthService },
      ],
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
    expect(second).toHaveBeenCalledWith({ hello: 'world' });
  });

  it('only calls the message handler once per publication', () => {
    const handler = vi.fn();
    const sub = service.subscribe('chat:room-1', handler) as unknown as MockSubscription;

    sub.emit('publication', { data: 'first' });
    sub.emit('publication', { data: 'second' });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls).toEqual([['first'], ['second']]);
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
    expect(handler).toHaveBeenCalledWith('restored');
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
    expect(latest).toHaveBeenCalledWith('after-reconnect');
  });

  it('does not restore a channel after it has been unsubscribed', () => {
    service.subscribe('chat:room-1', vi.fn());
    service.unsubscribe('chat:room-1');

    const replacement = new MockCentrifuge();
    (service as unknown as { centrifuge: MockCentrifuge | null }).centrifuge = replacement;
    (service as unknown as { restoreSubscriptions: () => void }).restoreSubscriptions();

    expect(replacement.getSubscription('chat:room-1')).toBeUndefined();
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
