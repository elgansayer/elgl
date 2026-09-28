import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';

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
}

class MockAuthService {
  getAccessToken = vi.fn().mockReturnValue('token');
}

describe('CentrifugeService', () => {
  let service: CentrifugeService;
  let httpMock: HttpTestingController;
  let mockCentrifuge: MockCentrifuge;

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

    mockCentrifuge = new MockCentrifuge();
    (service as unknown as { centrifuge: MockCentrifuge }).centrifuge = mockCentrifuge;
  });

  afterEach(() => {
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
});
