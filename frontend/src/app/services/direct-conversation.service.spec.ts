import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { DirectConversationService } from './direct-conversation.service';

describe('DirectConversationService', () => {
  it('posts the target user and returns the authoritative room id', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DirectConversationService,
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('token-123') },
        },
      ],
    });

    const service = TestBed.inject(DirectConversationService);
    const http = TestBed.inject(HttpTestingController);
    const requestPromise = service.openOrCreate('22222222-2222-4222-8222-222222222222');

    const request = http.expectOne(`${environment.apiUrl}/chat/direct-conversations`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      targetUserId: '22222222-2222-4222-8222-222222222222',
    });
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-123');
    request.flush({ roomId: '33333333-3333-4333-8333-333333333333' });

    await expect(requestPromise).resolves.toBe('33333333-3333-4333-8333-333333333333');
    http.verify();
  });

  it('fails closed when the server response has no room id', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DirectConversationService,
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('token-123') },
        },
      ],
    });

    const service = TestBed.inject(DirectConversationService);
    const http = TestBed.inject(HttpTestingController);
    const requestPromise = service.openOrCreate('22222222-2222-4222-8222-222222222222');
    http.expectOne(`${environment.apiUrl}/chat/direct-conversations`).flush({});

    await expect(requestPromise).rejects.toThrow('room ID');
    http.verify();
  });
});
