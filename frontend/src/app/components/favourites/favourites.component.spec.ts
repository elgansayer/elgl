import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FavouritesComponent } from './favourites.component';
import { I18nService } from '../../services/i18n.service';
import { ChatService, FavouriteRecord } from '../../services/chat.service';

describe('FavouritesComponent', () => {
  let component: FavouritesComponent;
  let fixture: ComponentFixture<FavouritesComponent>;
  let mockChatService: Partial<ChatService>;

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
    mockChatService = {
      getFavourites: vi.fn().mockResolvedValue(mockFavourites),
      removeFavourite: vi.fn().mockResolvedValue(undefined),
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
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FavouritesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load favourites on init', async () => {
    await fixture.whenStable();
    expect(mockChatService.getFavourites).toHaveBeenCalled();
    expect(component.favourites().length).toBe(3);
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
    expect(mockChatService.removeFavourite).toHaveBeenCalledWith('fav-1');
    expect(component.favourites().length).toBe(2);
  });

  it('should set active tab via setTab', () => {
    component.setTab('corrections');
    expect(component.activeTab()).toBe('corrections');

    component.setTab('all');
    expect(component.activeTab()).toBe('all');
  });
});