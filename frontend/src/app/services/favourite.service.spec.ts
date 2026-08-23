import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FavouriteService, AddFavouriteDto } from './favourite.service';
import { environment } from '../../environments/environment';
import type { FavouriteRecord } from './chat.service';

describe('FavouriteService', () => {
  let service: FavouriteService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/chat`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FavouriteService, provideHttpClient(), provideHttpClientTesting()],
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
    it('should POST to /chat/favourites with the dto', async () => {
      const dto: AddFavouriteDto = { message_id: 'msg-1', note_text: 'nice phrase' };
      const resultPromise = service.addFavourite(dto);

      const req = httpMock.expectOne(`${baseUrl}/favourites`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true });

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });

    it('should POST without note_text when omitted', async () => {
      const dto: AddFavouriteDto = { message_id: 'msg-2' };
      const resultPromise = service.addFavourite(dto);

      const req = httpMock.expectOne(`${baseUrl}/favourites`);
      expect(req.request.body).toEqual({ message_id: 'msg-2' });
      req.flush({ success: true });

      await resultPromise;
    });
  });

  describe('removeFavourite', () => {
    it('should DELETE to /chat/favourites/:id', async () => {
      const resultPromise = service.removeFavourite('fav-1');

      const req = httpMock.expectOne(`${baseUrl}/favourites/fav-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });

      const result = await resultPromise;
      expect(result).toEqual({ success: true });
    });
  });

  describe('getFavourites', () => {
    it('should GET from /chat/favourites', async () => {
      const mockFavourites: FavouriteRecord[] = [
        {
          id: 'fav-1',
          user_id: 'user-1',
          item_type: 'message',
          item_payload: { text_content: 'hello' },
          created_at: '2025-01-01T00:00:00Z',
        },
      ];
      const resultPromise = service.getFavourites();

      const req = httpMock.expectOne(`${baseUrl}/favourites`);
      expect(req.request.method).toBe('GET');
      req.flush(mockFavourites);

      const result = await resultPromise;
      expect(result).toEqual(mockFavourites);
    });
  });
});
