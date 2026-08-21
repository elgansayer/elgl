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
  on = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  publish = vi.fn();
  private subs = new Map<string, MockSubscription>();

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
