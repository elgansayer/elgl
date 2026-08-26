import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  MomentsStore,
  MomentLikeUser,
  MomentRecord,
} from './moments.store';
import { AuthService } from './auth.service';
import { HapticFeedbackService } from './haptic-feedback.service';
import { environment } from '../../environments/environment';

describe('MomentsStore', () => {
  let store: MomentsStore;
  let httpMock: HttpTestingController;
  let hapticFeedback: {
    success: ReturnType<typeof vi.fn>;
    tap: ReturnType<typeof vi.fn>;
  };

  const mockMoment: MomentRecord = {
    id: 'moment1',
    user_id: 'user1',
    text_content: 'Hello world',
    media_type: 'none',
    target_language: 'en',
    is_pinned: false,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString(),
    is_liked_by_me: false,
  };

  beforeEach(() => {
    const authSpy = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };
    hapticFeedback = {
      success: vi.fn(),
      tap: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        MomentsStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: HapticFeedbackService, useValue: hapticFeedback },
      ],
    });

    store = TestBed.inject(MomentsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should trigger haptic feedback and update the feed when a moment is liked', async () => {
    store.feed.set([mockMoment]);

    const promise = store.toggleLike('moment1');

    const req = httpMock.expectOne(`${environment.apiUrl}/moments/moment1/like`);
    expect(req.request.method).toBe('POST');
    req.flush({ likes_count: 1, is_liked: true });

    await promise;

    expect(hapticFeedback.success).toHaveBeenCalledTimes(1);
    expect(store.feed()[0].likes_count).toBe(1);
    expect(store.feed()[0].is_liked_by_me).toBe(true);
  });

  it('should not trigger haptic feedback when toggling a like fails', async () => {
    store.feed.set([mockMoment]);

    const promise = store.toggleLike('moment1');

    const req = httpMock.expectOne(`${environment.apiUrl}/moments/moment1/like`);
    req.error(new ProgressEvent('Network error'));

    await promise;

    expect(hapticFeedback.success).not.toHaveBeenCalled();
  });

  it('loads a bounded liker page through the configured authenticated API', async () => {
    const response: MomentLikeUser[] = [
      {
        id: 'user-2',
        display_name: 'Alice',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: ['ja'],
      },
    ];

    const promise = store.loadMomentLikes('moment1', 50, 25);

    const req = httpMock.expectOne((request) => {
      return (
        request.url === `${environment.apiUrl}/moments/moment1/likes` &&
        request.params.get('offset') === '50' &&
        request.params.get('limit') === '25'
      );
    });
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush(response);

    await expect(promise).resolves.toEqual(response);
  });
});
