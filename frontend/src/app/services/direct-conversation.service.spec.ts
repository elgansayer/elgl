import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { DirectConversationService } from './direct-conversation.service';

const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';

function configure(accessToken: string | null = 'token-123'): {
  service: DirectConversationService;
  http: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      DirectConversationService,
      {
        provide: AuthService,
        useValue: { getAccessToken: vi.fn().mockReturnValue(accessToken) },
      },
    ],
  });

  return {
    service: TestBed.inject(DirectConversationService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('DirectConversationService', () => {
  it('posts the target user and returns the authoritative room id', async () => {
    const { service, http } = configure();
    const requestPromise = service.openOrCreate(TARGET_ID);

    const request = http.expectOne(`${environment.apiUrl}/chat/direct-conversations`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ targetUserId: TARGET_ID });
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-123');
    request.flush({ roomId: ROOM_ID });

    await expect(requestPromise).resolves.toBe(ROOM_ID);
    http.verify();
  });

  it('fails closed before network access when there is no authenticated session', async () => {
    const { service, http } = configure(null);

    await expect(service.openOrCreate(TARGET_ID)).rejects.toThrow('authenticated session');
    http.expectNone(`${environment.apiUrl}/chat/direct-conversations`);
    http.verify();
  });

  it('rejects malformed target ids before network access', async () => {
    const { service, http } = configure();

    await expect(service.openOrCreate('../settings')).rejects.toThrow('target user ID');
    http.expectNone(`${environment.apiUrl}/chat/direct-conversations`);
    http.verify();
  });

  it.each([
    {},
    { roomId: '' },
    { roomId: 'not-a-room-id' },
    { roomId: 42 },
  ])('fails closed for malformed room responses: %j', async (response) => {
    const { service, http } = configure();
    const requestPromise = service.openOrCreate(TARGET_ID);

    http.expectOne(`${environment.apiUrl}/chat/direct-conversations`).flush(response);

    await expect(requestPromise).rejects.toThrow('valid room ID');
    http.verify();
  });
});
