import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';

class MockAuthService {
  getAccessToken = vi.fn().mockReturnValue(null);
}

describe('CentrifugeService reconnect boundary', () => {
  let service: CentrifugeService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CentrifugeService,
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    service = TestBed.inject(CentrifugeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.disconnect();
    httpMock.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('stops scheduling terminal reconnects after the configured retry budget', async () => {
    const internal = service as unknown as {
      reconnectAttempts: number;
      reconnectTimer: ReturnType<typeof setTimeout> | null;
      scheduleReconnect: (delay?: number) => void;
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      internal.scheduleReconnect(1);
      expect(internal.reconnectTimer).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1);

      expect(internal.reconnectTimer).toBeNull();
      expect(service.connectionStatus()).toBe('disconnected');
    }

    expect(internal.reconnectAttempts).toBe(8);

    internal.scheduleReconnect(1);

    expect(internal.reconnectTimer).toBeNull();
    expect(service.isConnected()).toBe(false);
    expect(service.connectionStatus()).toBe('error');
    expect(consoleError).toHaveBeenCalledWith(
      'Max Centrifugo reconnection attempts reached. Giving up.',
    );
  });
});
