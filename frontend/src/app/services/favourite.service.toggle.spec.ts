import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import type { FavouriteRecord } from './chat.service';
import { ChatCacheService } from './chat-cache.service';
import { FavouriteService } from './favourite.service';

describe('FavouriteService message toggle', () => {
  let service: FavouriteService;
  let http: HttpTestingController;
  const cache = {
    getCachedFavourites: vi.fn(),
    cacheFavourites: vi.fn().mockResolvedValue(undefined),
    invalidateFavourites: vi.fn().mockResolvedValue(undefined),
  };
  const baseUrl = `${environment.apiUrl}/chat`;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        FavouriteService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ChatCacheService, useValue: cache },
      ],
    });
    service = TestBed.inject(FavouriteService);
    http = TestBed.inject(HttpTestingController);
  });

  it('adds an unfavourited message and refreshes the IndexedDB cache', async () => {
    cache.getCachedFavourites.mockResolvedValue([]);
    const toggle = service.toggleMessageFavourite('message-1');

    http.expectOne(`${baseUrl}/favourites`).flush({ success: true });
    const refresh = http.expectOne(`${baseUrl}/favourites`);
    const favourite = {
      id: 'fav-1',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: { id: 'message-1' },
      created_at: '2026-08-16T00:00:00Z',
    } as FavouriteRecord;
    refresh.flush([favourite]);

    await expect(toggle).resolves.toBe(true);
    expect(cache.cacheFavourites).toHaveBeenCalledWith([favourite]);
    http.verify();
  });

  it('removes an already-favourited message and refreshes the IndexedDB cache', async () => {
    const favourite = {
      id: 'fav-1',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: { id: 'message-1' },
      created_at: '2026-08-16T00:00:00Z',
    } as FavouriteRecord;
    cache.getCachedFavourites.mockResolvedValue([favourite]);
    const toggle = service.toggleMessageFavourite('message-1');

    http.expectOne(`${baseUrl}/favourites/fav-1`).flush({ success: true });
    http.expectOne(`${baseUrl}/favourites`).flush([]);

    await expect(toggle).resolves.toBe(false);
    expect(cache.cacheFavourites).toHaveBeenCalledWith([]);
    http.verify();
  });
});
