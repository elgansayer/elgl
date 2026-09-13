import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('test-token') },
        },
      ],
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests a bounded filtered page with an encoded cursor', async () => {
    const promise = service.getNotifications('likes', {
      limit: 500,
      before: '2026-08-25T10:00:00.000Z',
    });
    const request = http.expectOne(
      (req) =>
        req.url === `${environment.apiUrl}/notifications` &&
        req.params.get('type') === 'likes' &&
        req.params.get('limit') === '50' &&
        req.params.get('before') === '2026-08-25T10:00:00.000Z',
    );
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush([]);
    await expect(promise).resolves.toEqual([]);
  });

  it('drops malformed records and unsafe avatar URLs', async () => {
    const promise = service.getNotifications();
    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/notifications`);
    request.flush([
      {
        id: 'd0aa8e62-d334-4d0f-8450-ecb998ed3bf5',
        recipient_id: 'me',
        actor_id: 'actor',
        type: 'follow',
        is_read: false,
        created_at: '2026-08-25T10:00:00.000Z',
        actor: { id: 'actor', display_name: 'Kana', avatar_url: 'javascript:alert(1)' },
      },
      { id: 'bad', type: 'unknown' },
    ]);

    const result = await promise;
    expect(result).toHaveLength(1);
    expect(result[0].actor?.avatar_url).toBeUndefined();
  });

  it('rejects malformed collection responses instead of fabricating notifications', async () => {
    const promise = service.getNotifications();
    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/notifications`);
    request.flush({ notifications: [] });
    await expect(promise).rejects.toThrow('Invalid notifications response');
  });

  it('rejects malformed unread counts instead of returning a fake badge', async () => {
    const promise = service.getUnreadCount();
    const request = http.expectOne(`${environment.apiUrl}/notifications/unread-count`);
    request.flush({ unreadCount: -1 });
    await expect(promise).rejects.toThrow('Invalid unread count response');
  });

  it('propagates read mutation failures for retryable UI feedback', async () => {
    const id = 'd0aa8e62-d334-4d0f-8450-ecb998ed3bf5';
    const promise = service.markAsRead(id);
    const request = http.expectOne(`${environment.apiUrl}/notifications/${id}/read`);
    request.flush({ message: 'unavailable' }, { status: 503, statusText: 'Unavailable' });
    await expect(promise).rejects.toBeDefined();
  });
});
