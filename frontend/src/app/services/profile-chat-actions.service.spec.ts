import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { ProfileChatActionsService } from './profile-chat-actions.service';
import { environment } from '../../environments/environment';

class AuthServiceStub {
  token: string | null = 'test-token';

  getAccessToken(): string | null {
    return this.token;
  }
}

describe('ProfileChatActionsService', () => {
  let service: ProfileChatActionsService;
  let http: HttpTestingController;
  let auth: AuthServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileChatActionsService,
        { provide: AuthService, useClass: AuthServiceStub },
      ],
    });
    service = TestBed.inject(ProfileChatActionsService);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService) as unknown as AuthServiceStub;
  });

  afterEach(() => http.verify());

  it('posts the partner id to the authenticated direct-room endpoint', async () => {
    const promise = service.openDirectChat('partner-1');
    const req = http.expectOne(`${environment.apiUrl}/chat/direct-rooms`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ partnerId: 'partner-1' });
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({ room_id: '33333333-3333-4333-8333-333333333333' });

    await expect(promise).resolves.toEqual({
      room_id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('fails before the network when there is no authenticated session', async () => {
    auth.token = null;
    await expect(service.openDirectChat('partner-1')).rejects.toThrow(
      'Authentication required',
    );
    http.expectNone(`${environment.apiUrl}/chat/direct-rooms`);
  });

  it('rejects malformed room ids instead of navigating to an untrusted path', async () => {
    const promise = service.openDirectChat('partner-1');
    const req = http.expectOne(`${environment.apiUrl}/chat/direct-rooms`);
    req.flush({ room_id: '../settings' });

    await expect(promise).rejects.toThrow('Invalid direct chat response');
  });
});
