import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FavouritesComponent } from './favourites.component';
import { I18nService } from '../../services/i18n.service';
import { FavouriteRecord } from '../../services/chat.service';
import { FavouriteService } from '../../services/favourite.service';

describe('FavouritesComponent', () => {
  let component: FavouritesComponent;
  let fixture: ComponentFixture<FavouritesComponent>;
  let mockFavouriteService: {
    getStarredMessages: ReturnType<typeof vi.fn>;
    removeFavourite: ReturnType<typeof vi.fn>;
  };

  const mockFavourites: FavouriteRecord[] = [
    {
      id: 'fav-1',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: {
        id: 'msg-1',
        room_id: 'room-1',
        sender_id: 'sender-1',
        message_type: 'text',
        text_content: 'Hello world!',
        is_read: true,
        created_at: '2025-01-01T00:00:00Z',
        sender: {
          id: 'sender-1',
          display_name: 'Maria',
          avatar_url: null,
        },
      },
      notes: 'Useful phrase',
      created_at: '2025-01-02T00:00:00Z',
    } as unknown as FavouriteRecord,
    {
      id: 'fav-2',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: {
        id: 'msg-2',
        room_id: 'room-1',
        sender_id: 'sender-2',
        message_type: 'correction',
        text_content: 'I goes to school',
        correction_payload: {
          original: 'I goes to school',
          corrected: 'I go to school',
          explanation: 'Subject-verb agreement',
        },
        is_read: true,
        created_at: '2025-01-03T00:00:00Z',
        sender: {
          id: 'sender-2',
          display_name: 'John',
          avatar_url: null,
        },
      },
      notes: null,
      created_at: '2025-01-04T00:00:00Z',
    } as unknown as FavouriteRecord,
    {
      id: 'fav-3',
      user_id: 'user-1',
      item_type: 'audio',
      item_payload: {
        id: 'msg-3',
        room_id: 'room-1',
        sender_id: 'sender-3',
        message_type: 'voice',
        media_url: 'https://example.com/audio.mp3',
        text_content: 'Voice transcript',
        is_read: true,
        created_at: '2025-01-05T00:00:00Z',
        sender: {
          id: 'sender-3',
          display_name: 'Ana',
          avatar_url: null,
        },
      },
      notes: null,
      created_at: '2025-01-06T00:00:00Z',
    } as unknown as FavouriteRecord,
  ];

  beforeEach(async () => {
    mockFavouriteService = {
      getStarredMessages: vi.fn().mockResolvedValue({
        items: mockFavourites,
        has_more: false,
        next_offset: null,
      }),
      removeFavourite: vi.fn().mockResolvedValue({ success: true }),
    };

    await TestBed.configureTestingModule({
      imports: [FavouritesComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>): string => {
              let text = key;
              if (params) {
                for (const [k, v] of Object.entries(params)) {
                  text = text.split(`{{${k}}}`).join(String(v));
                }
              }
              return text;
            },
          },
        },
        { provide: FavouriteService, useValue: mockFavouriteService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FavouritesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load starred messages on init', async () => {
    await fixture.whenStable();
    expect(mockFavouriteService.getStarredMessages).toHaveBeenCalledWith(100, 0);
    expect(component.favourites().length).toBe(3);
  });

  it('continues through bounded pages until the server reports completion', async () => {
    mockFavouriteService.getStarredMessages
      .mockResolvedValueOnce({
        items: [mockFavourites[0]],
        has_more: true,
        next_offset: 100,
      })
      .mockResolvedValueOnce({
        items: [mockFavourites[1]],
        has_more: false,
        next_offset: null,
      });

    await component.loadFavourites();

    expect(mockFavouriteService.getStarredMessages).toHaveBeenNthCalledWith(2, 100, 0);
    expect(mockFavouriteService.getStarredMessages).toHaveBeenLastCalledWith(100, 100);
    expect(component.favourites().map((favourite) => favourite.id)).toEqual([
      'fav-1',
      'fav-2',
    ]);
  });

  it('fails safely if pagination does not advance', async () => {
    mockFavouriteService.getStarredMessages.mockResolvedValue({
      items: [mockFavourites[0]],
      has_more: true,
      next_offset: 0,
    });

    await component.loadFavourites();

    expect(component.loadError()).toBe(true);
  });

  it('should default to "all" tab', () => {
    expect(component.activeTab()).toBe('all');
  });

  it('should show all favourites when tab is "all"', async () => {
    await fixture.whenStable();
    expect(component.filteredFavourites().length).toBe(3);
  });

  it('should filter to text messages only', async () => {
    await fixture.whenStable();
    component.setTab('messages');
    expect(component.filteredFavourites().length).toBe(1);
    expect(component.filteredFavourites()[0].id).toBe('fav-1');
  });

  it('should filter to corrections only', async () => {
    await fixture.whenStable();
    component.setTab('corrections');
    expect(component.filteredFavourites().length).toBe(1);
    expect(component.filteredFavourites()[0].id).toBe('fav-2');
  });

  it('should filter to audio only', async () => {
    await fixture.whenStable();
    component.setTab('audio');
    expect(component.filteredFavourites().length).toBe(1);
    expect(component.filteredFavourites()[0].id).toBe('fav-3');
  });

  it('should filter to moments only (empty)', async () => {
    await fixture.whenStable();
    component.setTab('moments');
    expect(component.filteredFavourites().length).toBe(0);
  });

  it('should return correct empty state key per tab', async () => {
    await fixture.whenStable();
    expect(component.emptyStateKey()).toBe('favourites.empty');

    component.setTab('messages');
    expect(component.emptyStateKey()).toBe('favourites.noMessages');

    component.setTab('corrections');
    expect(component.emptyStateKey()).toBe('favourites.noCorrections');

    component.setTab('audio');
    expect(component.emptyStateKey()).toBe('favourites.noAudio');

    component.setTab('moments');
    expect(component.emptyStateKey()).toBe('favourites.noMoments');
  });

  it('should delete a favourite and remove it from the list', async () => {
    await fixture.whenStable();
    expect(component.favourites().length).toBe(3);

    await component.deleteFavourite(mockFavourites[0]);
    expect(mockFavouriteService.removeFavourite).toHaveBeenCalledWith('fav-1');
    expect(component.favourites().length).toBe(2);
  });

  it('should prevent duplicate delete requests while a favourite is pending', async () => {
    await fixture.whenStable();
    let resolveDelete: (() => void) | undefined;
    const deletePromise = new Promise<{ success: true }>((resolve) => {
      resolveDelete = () => resolve({ success: true });
    });
    mockFavouriteService.removeFavourite.mockReturnValue(deletePromise);

    const firstDelete = component.deleteFavourite(mockFavourites[0]);
    const duplicateDelete = component.deleteFavourite(mockFavourites[0]);

    expect(component.isDeletingFavourite('fav-1')).toBe(true);
    expect(mockFavouriteService.removeFavourite).toHaveBeenCalledTimes(1);

    resolveDelete?.();
    await Promise.all([firstDelete, duplicateDelete]);

    expect(component.isDeletingFavourite('fav-1')).toBe(false);
    expect(component.favourites().some((favourite) => favourite.id === 'fav-1')).toBe(false);
  });

  it('should expose list semantics and keep item type badges non-interactive', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="list"]')).not.toBeNull();
    expect(host.querySelectorAll('[role="listitem"]').length).toBe(3);
    expect(host.querySelectorAll('app-chip').length).toBe(5);
  });

  it('should only mark audio as playing after playback starts and stop it on destroy', async () => {
    await fixture.whenStable();
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const audio = {
      play,
      pause,
      currentTime: 0,
      onended: null as (() => void) | null,
    };
    vi.stubGlobal(
      'Audio',
      vi.fn(function () {
        return audio;
      }),
    );

    component.toggleAudio(mockFavourites[2]);
    expect(component.audioPlayingId()).toBeNull();

    await play.mock.results[0].value;
    await Promise.resolve();
    expect(component.audioPlayingId()).toBe('fav-3');

    fixture.destroy();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
    expect(component.audioPlayingId()).toBeNull();
  });

  it('should expose the correct accessible audio action for play and pause', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('button[aria-label="favourites.audioPlay"]')).not.toBeNull();

    component.audioPlayingId.set('fav-3');
    fixture.detectChanges();
    expect(host.querySelector('button[aria-label="favourites.audioPause"]')).not.toBeNull();
  });

  it('should set active tab via setTab', () => {
    component.setTab('corrections');
    expect(component.activeTab()).toBe('corrections');

    component.setTab('all');
    expect(component.activeTab()).toBe('all');
  });
});
