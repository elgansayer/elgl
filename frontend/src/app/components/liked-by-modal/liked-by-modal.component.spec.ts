import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import {
  MomentLikeUser,
  MomentsStore,
} from '../../services/moments.store';
import { LikedByModalComponent } from './liked-by-modal.component';

describe('LikedByModalComponent', () => {
  let component: LikedByModalComponent;
  let fixture: ComponentFixture<LikedByModalComponent>;
  let loadMomentLikes: ReturnType<typeof vi.fn>;

  const users: MomentLikeUser[] = [
    {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: null,
      native_languages: ['en'],
      target_languages: ['ja'],
    },
    {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: 'https://example.com/bob.jpg',
      native_languages: ['fr'],
      target_languages: ['en'],
    },
  ];

  beforeEach(async () => {
    loadMomentLikes = vi.fn().mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [LikedByModalComponent],
      providers: [
        provideRouter([]),
        {
          provide: MomentsStore,
          useValue: { loadMomentLikes },
        },
        {
          provide: I18nService,
          useValue: {
            translations: signal({}),
            translate: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LikedByModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('momentId', 'moment-123');
  });

  afterEach(() => {
    fixture.destroy();
    vi.clearAllMocks();
  });

  async function start(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads the first authenticated page when the modal opens', async () => {
    loadMomentLikes.mockResolvedValue(users);

    await start();

    expect(loadMomentLikes).toHaveBeenCalledWith('moment-123', 0, 50);
    expect(component.users()).toEqual(users);
    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe(false);
    expect(component.hasMore()).toBe(false);
  });

  it('shows a retryable failure without retaining stale users', async () => {
    loadMomentLikes.mockRejectedValue(new Error('private provider detail'));

    await start();

    expect(component.users()).toEqual([]);
    expect(component.loadError()).toBe(true);
    expect(component.isLoading()).toBe(false);
    expect(document.body.textContent).toContain('common.loadError');
  });

  it('retries the first page after an initial failure', async () => {
    loadMomentLikes
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(users);

    await start();
    expect(component.loadError()).toBe(true);

    component.retry();
    await fixture.whenStable();

    expect(loadMomentLikes).toHaveBeenNthCalledWith(2, 'moment-123', 0, 50);
    expect(component.users()).toEqual(users);
    expect(component.loadError()).toBe(false);
  });

  it('appends and deduplicates additional pages', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      id: `user-${index}`,
      display_name: `User ${index}`,
      avatar_url: null,
      native_languages: ['en'],
      target_languages: ['ja'],
    }));
    loadMomentLikes
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        firstPage[49],
        {
          id: 'user-50',
          display_name: 'User 50',
          avatar_url: null,
          native_languages: ['en'],
          target_languages: ['ja'],
        },
      ]);

    await start();
    expect(component.hasMore()).toBe(true);

    await component.loadMore();

    expect(loadMomentLikes).toHaveBeenNthCalledWith(2, 'moment-123', 50, 50);
    expect(component.users()).toHaveLength(51);
    expect(component.users().at(-1)?.id).toBe('user-50');
    expect(component.hasMore()).toBe(false);
  });

  it('does not issue duplicate load-more requests while one is pending', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      id: `user-${index}`,
      display_name: `User ${index}`,
      avatar_url: null,
      target_languages: ['ja'],
    }));
    let resolvePage: ((value: MomentLikeUser[]) => void) | undefined;
    const pendingPage = new Promise<MomentLikeUser[]>((resolve) => {
      resolvePage = resolve;
    });
    loadMomentLikes
      .mockResolvedValueOnce(firstPage)
      .mockReturnValueOnce(pendingPage);

    await start();

    const firstLoad = component.loadMore();
    const secondLoad = component.loadMore();
    expect(loadMomentLikes).toHaveBeenCalledTimes(2);

    resolvePage?.([]);
    await Promise.all([firstLoad, secondLoad]);
    expect(component.isLoadingMore()).toBe(false);
  });

  it('ignores a stale response when the moment changes', async () => {
    let resolveFirst: ((value: MomentLikeUser[]) => void) | undefined;
    const firstRequest = new Promise<MomentLikeUser[]>((resolve) => {
      resolveFirst = resolve;
    });
    loadMomentLikes
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce([users[1]]);

    fixture.detectChanges();
    fixture.componentRef.setInput('momentId', 'moment-456');
    fixture.detectChanges();
    await fixture.whenStable();

    resolveFirst?.([users[0]]);
    await fixture.whenStable();

    expect(component.users()).toEqual([users[1]]);
    expect(loadMomentLikes).toHaveBeenNthCalledWith(2, 'moment-456', 0, 50);
  });

  it('exposes profile links and hides incomplete language pairs', async () => {
    loadMomentLikes.mockResolvedValue([
      users[0],
      {
        id: 'user-3',
        display_name: 'No target yet',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: [],
      },
    ]);

    await start();

    const links = Array.from(
      document.body.querySelectorAll('a[role="listitem"]'),
    ) as HTMLAnchorElement[];
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toContain('/profile/user/user-1');
    expect(component.hasLanguagePair(users[0])).toBe(true);
    expect(
      component.hasLanguagePair({
        id: 'user-3',
        display_name: 'No target yet',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: [],
      }),
    ).toBe(false);
  });

  it('clears pending pagination when the modal closes and reopens', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      id: `user-${index}`,
      display_name: `User ${index}`,
      avatar_url: null,
      native_languages: ['en'],
      target_languages: ['ja'],
    }));
    let resolvePage: ((value: MomentLikeUser[]) => void) | undefined;
    const pendingPage = new Promise<MomentLikeUser[]>((resolve) => {
      resolvePage = resolve;
    });
    loadMomentLikes
      .mockResolvedValueOnce(firstPage)
      .mockReturnValueOnce(pendingPage)
      .mockResolvedValueOnce([]);

    await start();
    const loadMore = component.loadMore();
    expect(component.isLoadingMore()).toBe(true);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(component.isLoadingMore()).toBe(false);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.isLoadingMore()).toBe(false);

    resolvePage?.([]);
    await loadMore;
  });

  it('emits close when the Spartan dialog closes', async () => {
    loadMomentLikes.mockResolvedValue([]);
    await start();
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    component.onDialogStateChanged('closed');

    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
