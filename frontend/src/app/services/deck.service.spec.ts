import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DeckService, Deck, CreateDeckDto, UpdateDeckDto } from './deck.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('DeckService', () => {
  let service: DeckService;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  const mockToken = 'test-jwt-token';
  let authSpy: { getAccessToken: ReturnType<typeof vi.fn> };

  const mockDeck: Deck = {
    id: 'deck-1',
    user_id: 'user-1',
    name: 'Spanish Verbs',
    description: 'Essential verbs for beginners',
    colour: '#6366f1',
    icon: '📚',
    card_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.resetTestingModule();

    authSpy = {
      getAccessToken: vi.fn().mockReturnValue(mockToken),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
      ],
    });

    service = TestBed.inject(DeckService);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = `${environment.apiUrl}/decks`;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getDecks', () => {
    it('should fetch all decks for the user', async () => {
      const decks = [mockDeck];
      const promise = service.getDecks();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
      req.flush(decks);

      const result = await promise;
      expect(result).toEqual(decks);
    });
  });

  describe('getDeck', () => {
    it('should fetch a single deck by id', async () => {
      const promise = service.getDeck('deck-1');

      const req = httpMock.expectOne(`${baseUrl}/deck-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockDeck);

      const result = await promise;
      expect(result).toEqual(mockDeck);
    });
  });

  describe('createDeck', () => {
    it('should create a new deck', async () => {
      const dto: CreateDeckDto = {
        name: 'French Phrases',
        description: 'Common travel phrases',
        colour: '#ec4899',
        icon: '✈️',
      };
      const createdDeck = { ...mockDeck, ...dto, id: 'deck-2' };

      const promise = service.createDeck(dto);

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(createdDeck);

      const result = await promise;
      expect(result).toEqual(createdDeck);
    });
  });

  describe('updateDeck', () => {
    it('should update an existing deck', async () => {
      const dto: UpdateDeckDto = { name: 'Updated Name' };
      const updatedDeck = { ...mockDeck, name: 'Updated Name' };

      const promise = service.updateDeck('deck-1', dto);

      const req = httpMock.expectOne(`${baseUrl}/deck-1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush(updatedDeck);

      const result = await promise;
      expect(result).toEqual(updatedDeck);
    });
  });

  describe('deleteDeck', () => {
    it('should delete a deck by id', async () => {
      const promise = service.deleteDeck('deck-1');

      const req = httpMock.expectOne(`${baseUrl}/deck-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 200, statusText: 'OK' });

      await promise;
    });
  });

  describe('addFlashcardToDeck', () => {
    it('should add a flashcard to a deck', async () => {
      const promise = service.addFlashcardToDeck('deck-1', 'fc-1');

      const req = httpMock.expectOne(`${baseUrl}/deck-1/flashcards`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ flashcard_id: 'fc-1' });
      req.flush(null, { status: 200, statusText: 'OK' });

      await promise;
    });
  });

  describe('removeFlashcardFromDeck', () => {
    it('should remove a flashcard from a deck', async () => {
      const promise = service.removeFlashcardFromDeck('deck-1', 'fc-1');

      const req = httpMock.expectOne(`${baseUrl}/deck-1/flashcards/fc-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 200, statusText: 'OK' });

      await promise;
    });
  });

  describe('getDeckFlashcards', () => {
    it('should fetch flashcard IDs for a deck', async () => {
      const ids = [{ id: 'fc-1' }, { id: 'fc-2' }];

      const promise = service.getDeckFlashcards('deck-1');

      const req = httpMock.expectOne(`${baseUrl}/deck-1/flashcards`);
      expect(req.request.method).toBe('GET');
      req.flush(ids);

      const result = await promise;
      expect(result).toEqual(['fc-1', 'fc-2']);
    });
  });
});