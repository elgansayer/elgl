import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FavouritesComponent } from './favourites.component';
import { I18nService } from '../../services/i18n.service';
import { ChatService, FavouriteRecord } from '../../services/chat.service';

describe('FavouritesComponent failure handling', () => {
  let fixture: ComponentFixture<FavouritesComponent>;
  let component: FavouritesComponent;
  let chatService: {
    getFavourites: ReturnType<typeof vi.fn>;
    removeFavourite: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    chatService = {
      getFavourites: vi.fn().mockRejectedValue(new Error('provider unavailable')),
      removeFavourite: vi.fn().mockRejectedValue(new Error('delete unavailable')),
    };

    await TestBed.configureTestingModule({
      imports: [FavouritesComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string): string => key,
          },
        },
        { provide: ChatService, useValue: chatService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FavouritesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows an accessible retry action instead of misreporting a load failure as empty data', () => {
    expect(component.loadError()).toBe(true);
    expect(component.isLoading()).toBe(false);

    const host = fixture.nativeElement as HTMLElement;
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('common.error_generic');
    expect(alert?.querySelector('button')?.textContent).toContain('common.retry');
    expect(host.textContent).not.toContain('favourites.empty');
  });

  it('can retry loading after a transient failure', async () => {
    const favourite = {
      id: 'fav-1',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: {
        id: '00000000-0000-4000-8000-000000000001',
        room_id: '00000000-0000-4000-8000-000000000002',
        sender_id: '00000000-0000-4000-8000-000000000003',
        message_type: 'text',
        text_content: 'Saved phrase',
        created_at: '2026-08-23T12:00:00Z',
      },
      created_at: '2026-08-23T12:01:00Z',
    } as FavouriteRecord;
    chatService.getFavourites.mockResolvedValueOnce([favourite]);

    await component.loadFavourites();
    fixture.detectChanges();

    expect(component.loadError()).toBe(false);
    expect(component.favourites()).toEqual([favourite]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Saved phrase');
  });

  it('keeps a favourite available when deletion fails and clears the busy state', async () => {
    const favourite = {
      id: 'fav-2',
      user_id: 'user-1',
      item_type: 'message',
      item_payload: {},
      created_at: '2026-08-23T12:01:00Z',
    } as FavouriteRecord;
    component.favourites.set([favourite]);

    await component.deleteFavourite(favourite);

    expect(component.favourites()).toEqual([favourite]);
    expect(component.deleteError()).toBe(true);
    expect(component.isDeletingFavourite(favourite.id)).toBe(false);
  });
});
