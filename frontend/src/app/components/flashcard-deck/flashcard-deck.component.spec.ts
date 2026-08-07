import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlashcardDeckComponent } from './flashcard-deck.component';
import { DeckService, Deck } from '../../services/deck.service';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';

describe('FlashcardDeckComponent', () => {
  let component: FlashcardDeckComponent;
  let fixture: ComponentFixture<FlashcardDeckComponent>;

  const mockDecks: Deck[] = [
    {
      id: 'd1',
      user_id: 'user-1',
      name: 'Spanish Verbs',
      description: 'Essential verbs',
      colour: '#6366f1',
      icon: '📚',
      card_count: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'd2',
      user_id: 'user-1',
      name: 'Travel Phrases',
      description: null,
      colour: '#ec4899',
      icon: '✈️',
      card_count: 0,
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    },
  ];

  const mockFlashcards: Flashcard[] = [
    {
      id: 'fc-1',
      user_id: 'user-1',
      word_token: 'hablar',
      translation: 'to speak',
      srs_level: 2,
      next_review_at: '2026-02-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'fc-2',
      user_id: 'user-1',
      word_token: 'comer',
      translation: 'to eat',
      srs_level: 0,
      next_review_at: '2026-02-01T00:00:00Z',
      created_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'fc-3',
      user_id: 'user-1',
      word_token: 'vivir',
      translation: 'to live',
      srs_level: 4,
      next_review_at: '2026-03-01T00:00:00Z',
      created_at: '2026-01-03T00:00:00Z',
    },
  ];

  const translateFn = (key: string, params?: Record<string, unknown>): string => {
    let text = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.split(`{{${k}}}`).join(String(v));
      }
    }
    return text;
  };

  const mockDeckService = {
    getDecks: vi.fn().mockResolvedValue([] as Deck[]),
    createDeck: vi.fn().mockImplementation((dto: { name: string; description?: string; colour?: string; icon?: string }) =>
      Promise.resolve({
        id: 'new-deck',
        user_id: 'user-1',
        name: dto.name,
        description: dto.description ?? null,
        colour: dto.colour ?? '#6366f1',
        icon: dto.icon ?? '📚',
        card_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    ),
    updateDeck: vi.fn().mockResolvedValue(null as Deck | null),
    deleteDeck: vi.fn().mockResolvedValue(undefined),
    addFlashcardToDeck: vi.fn().mockResolvedValue(undefined),
    removeFlashcardFromDeck: vi.fn().mockResolvedValue(undefined),
    getDeckFlashcards: vi.fn().mockResolvedValue(['fc-1', 'fc-2'] as string[]),
  };

  const mockVocabularyStore = {
    allFlashcards: vi.fn().mockReturnValue([] as Flashcard[]),
    loadAllFlashcards: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlashcardDeckComponent],
      providers: [
        { provide: DeckService, useValue: mockDeckService },
        { provide: VocabularyStore, useValue: mockVocabularyStore },
        {
          provide: I18nService,
          useValue: { translate: translateFn } as unknown as I18nService,
        },
      ],
    }).compileComponents();

    vi.clearAllMocks();
    mockDeckService.getDecks.mockResolvedValue([]);
    mockVocabularyStore.allFlashcards.mockReturnValue([]);

    fixture = TestBed.createComponent(FlashcardDeckComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no decks exist', async () => {
    // Wait for the constructor's loadDecks() to complete
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('deck.emptyTitle');
    expect(el.textContent).toContain('deck.emptyDesc');
  });

  it('should display decks when loaded', async () => {
    await fixture.whenStable();
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    await component.loadDecks();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Spanish Verbs');
    expect(el.textContent).toContain('Travel Phrases');
    // The i18n mock returns the translation key; card count uses deck.cardCount key
    expect(el.textContent).toContain('deck.cardCount');
  });

  it('should toggle create form visibility', () => {
    expect(component.showCreateForm()).toBe(false);
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(true);
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(false);
  });

  it('should create a new deck', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    await component.loadDecks();
    component.toggleCreateForm();
    component.newDeckName.set('French Verbs');
    component.newDeckDescription.set('Basic verbs');
    component.newDeckColour.set('#f59e0b');
    component.newDeckIcon.set('🎯');

    fixture.detectChanges();
    await component.createDeck();

    expect(mockDeckService.createDeck).toHaveBeenCalledWith({
      name: 'French Verbs',
      description: 'Basic verbs',
      colour: '#f59e0b',
      icon: '🎯',
    });
    expect(component.showCreateForm()).toBe(false);
  });

  it('should not create deck with empty name', async () => {
    await component.loadDecks();
    component.toggleCreateForm();
    component.newDeckName.set('   ');
    await component.createDeck();
    expect(mockDeckService.createDeck).not.toHaveBeenCalled();
  });

  it('should open deck detail view', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    await component.loadDecks();
    fixture.detectChanges();

    await component.openDeckDetail(mockDecks[0]);
    fixture.detectChanges();

    expect(component.activeView()).toBe('detail');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('deck.backBtn');
    expect(el.textContent).toContain('deck.editBtn');
  });

  it('should delete a deck', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    await component.loadDecks();
    fixture.detectChanges();

    await component.deleteDeckById('d1', new MouseEvent('click'));
    expect(mockDeckService.deleteDeck).toHaveBeenCalledWith('d1');
  });

  it('should add flashcard to deck in detail view', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    mockVocabularyStore.allFlashcards.mockReturnValue(mockFlashcards);
    mockDeckService.getDeckFlashcards.mockResolvedValue(['fc-1']);

    await component.loadDecks();
    await component.openDeckDetail(mockDecks[0]);
    fixture.detectChanges();

    await component.addCardToDeck('fc-2');
    fixture.detectChanges();

    expect(mockDeckService.addFlashcardToDeck).toHaveBeenCalledWith('d1', 'fc-2');
  });

  it('should remove flashcard from deck in detail view', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    mockVocabularyStore.allFlashcards.mockReturnValue(mockFlashcards);
    mockDeckService.getDeckFlashcards.mockResolvedValue(['fc-1', 'fc-2']);

    await component.loadDecks();
    await component.openDeckDetail(mockDecks[0]);
    fixture.detectChanges();

    await component.removeCardFromDeck('fc-1');
    fixture.detectChanges();

    expect(mockDeckService.removeFlashcardFromDeck).toHaveBeenCalledWith('d1', 'fc-1');
  });

  it('should save deck edits', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    mockDeckService.updateDeck.mockResolvedValue({
      ...mockDecks[0],
      name: 'Edited Name',
    });

    await component.loadDecks();
    await component.openDeckDetail(mockDecks[0]);
    component.toggleEditForm();
    // toggleEditForm populates editDeckDescription from deck.description ('Essential verbs')
    component.editDeckName.set('Edited Name');
    fixture.detectChanges();

    await component.saveDeckEdits();
    expect(mockDeckService.updateDeck).toHaveBeenCalledWith('d1', {
      name: 'Edited Name',
      description: 'Essential verbs',
      colour: '#6366f1',
      icon: '📚',
    });
    expect(component.showEditForm()).toBe(false);
  });

  it('should filter available flashcards excluding those already in deck', async () => {
    mockDeckService.getDecks.mockResolvedValue(mockDecks);
    mockVocabularyStore.allFlashcards.mockReturnValue(mockFlashcards);
    mockDeckService.getDeckFlashcards.mockResolvedValue(['fc-1']);

    await component.loadDecks();
    await component.openDeckDetail(mockDecks[0]);
    fixture.detectChanges();

    const available = component.availableFlashcards();
    expect(available.length).toBe(2);
    expect(available.find((f) => f.id === 'fc-1')).toBeUndefined();
    expect(available.find((f) => f.id === 'fc-2')).toBeDefined();
    expect(available.find((f) => f.id === 'fc-3')).toBeDefined();
  });
});