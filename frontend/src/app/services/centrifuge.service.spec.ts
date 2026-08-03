import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';

class MockSubscription {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  subscribe = jasmine.createSpy('subscribe');
  unsubscribe = jasmine.createSpy('unsubscribe');
  publish = jasmine.createSpy('publish').and.returnValue(Promise.resolve());

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
  on = jasmine.createSpy('on');
  connect = jasmine.createSpy('connect');
  disconnect = jasmine.createSpy('disconnect');
  publish = jasmine.createSpy('publish');
  private subs = new Map<string, MockSubscription>();

  newSubscription(channel: string): MockSubscription {
    const sub = new MockSubscription();
    this.subs.set(channel, sub);
    return sub;
  }
}

class MockAuthService {
  getAccessToken = jasmine.createSpy('getAccessToken').and.returnValue('token');
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
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');

    const sub = service.subscribe('chat:room-1', first) as unknown as MockSubscription;
    service.subscribe('chat:room-1', second);

    expect(sub.listenerCount('publication')).toBe(1);

    sub.emit('publication', { data: { hello: 'world' } });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ hello: 'world' });
  });

  it('only calls the message handler once per publication', () => {
    const handler = jasmine.createSpy('handler');
    const sub = service.subscribe('chat:room-1', handler) as unknown as MockSubscription;

    sub.emit('publication', { data: 'first' });
    sub.emit('publication', { data: 'second' });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.calls.allArgs()).toEqual([['first'], ['second']]);
  });
});
