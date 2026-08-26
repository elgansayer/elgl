import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import type { FavouriteRecord } from './chat.service';
import { AddFavouriteDto, FavouriteService } from './favourite.service';

describe('FavouriteService', () => {
  let service: FavouriteService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/favourites`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FavouriteService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FavouriteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('addFavourite', () => {
    it('should POST to the canonical favourites endpoint with the dto', async () => {
      const dto: AddFavouriteDto = {
        message_id: 'msg-1',
        note_text: 'nice phrase',
      };
      const resultPromise = service.addFavourite(dto);

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true });

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });

    it('should POST without note_text when omitted', async () => {
      const dto: AddFavouriteDto = { message_id: 'msg-2' };
      const resultPromise = service.addFavourite(dto);

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.body).toEqual({ message_id: 'msg-2' });
      req.flush({ success: true });

      await resultPromise;
    });
  });

  describe('removeFavourite', () => {
    it('should DELETE the authenticated favourite id', async () => {
      const resultPromise = service.removeFavourite('fav-1');

      const req = httpMock.expectOne(`${baseUrl}/fav-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });
  });

  describe('getFavourites', () => {
    it('keeps the legacy canonical favourites read available', async () => {
      const resultPromise = service.getFavourites();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush([]);

      await expect(resultPromise).resolves.toEqual([]);
    });
  });

  describe('getStarredMessages', () => {
    const mockFavourite: FavouriteRecord = {
      id: 'fav-1',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'user-2',
        message_type: 'text',
        text_content: 'hello',
        is_read: false,
        created_at: '2025-01-01T00:00:00Z',
      },
      created_at: '2025-01-01T00:00:00Z',
    };

    it('requests a bounded page with explicit limit and offset', async () => {
      const resultPromise = service.getStarredMessages(25, 50);

      const req = httpMock.expectOne(
        (request) =>
          request.url === `${baseUrl}/messages` &&
          request.params.get('limit') === '25' &&
          request.params.get('offset') === '50',
      );
      expect(req.request.method).toBe('GET');
      req.flush({
        items: [mockFavourite],
        has_more: true,
        next_offset: 75,
      });

      await expect(resultPromise).resolves.toEqual({
        items: [mockFavourite],
        has_more: true,
        next_offset: 75,
      });
    });

    it('rejects malformed pagination metadata instead of trusting the response', async () => {
      const resultPromise = service.getStarredMessages();
      const req = httpMock.expectOne(
        (request) => request.url === `${baseUrl}/messages`,
      );
      req.flush({ items: [], has_more: true, next_offset: -1 });

      await expect(resultPromise).rejects.toThrow('Invalid starred messages response');
    });
  });
});
