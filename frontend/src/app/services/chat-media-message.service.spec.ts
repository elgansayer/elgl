import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ChatMediaMessageService } from './chat-media-message.service';

describe('ChatMediaMessageService', () => {
  let service: ChatMediaMessageService;
  let httpMock: HttpTestingController;
  const auth = { getAccessToken: vi.fn(() => 'access-token') };

  beforeEach(() => {
    auth.getAccessToken.mockReturnValue('access-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChatMediaMessageService,
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(ChatMediaMessageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(['image', 'video'] as const)('sends %s media through the authenticated media API', async (kind) => {
    const objectKey = `chat-media/user/${kind}/hd/123-aaaaaaaaaaaaaaaaaaaaaaaa.${kind === 'image' ? 'jpg' : 'mp4'}`;
    const sendPromise = service.send('room-123', {
      url: `https://cdn.example/${kind}`,
      objectKey,
      kind,
      quality: 'hd',
    });

    const request = httpMock.expectOne(`${environment.apiUrl}/media/chat/send`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(request.request.body).toEqual({
      roomId: 'room-123',
      mediaKind: kind,
      objectKey,
    });
    request.flush({ id: 'message-1' });

    await expect(sendPromise).resolves.toBeUndefined();
  });

  it('fails before network I/O when no session exists', async () => {
    auth.getAccessToken.mockReturnValue(null as never);
    await expect(
      service.send('room-123', {
        url: 'https://cdn.example/image',
        objectKey: 'chat-media/user/image/standard/123-aaaaaaaaaaaaaaaaaaaaaaaa.jpg',
        kind: 'image',
        quality: 'standard',
      }),
    ).rejects.toThrow('Sign in before sending chat media');
  });
});
