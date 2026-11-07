import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { ProfileVisitsService } from '../../services/profile-visits.service';
import { ProfileVisit, ProfileVisitorsPage } from '../../interfaces/profile-visit.interface';
import { ProfileVisitorsComponent } from './profile-visitors.component';

function makeVisit(id: string, visitorId = `visitor-${id}`): ProfileVisit {
  return {
    id,
    created_at: '2026-08-20T12:00:00.000Z',
    is_blurred: false,
    visitor: {
      id: visitorId,
      display_name: `Visitor ${id}`,
      avatar_url: null,
      native_languages: ['en'],
      target_languages: ['ja'],
    },
  };
}

function makePage(overrides: Partial<ProfileVisitorsPage> = {}): ProfileVisitorsPage {
  return {
    items: [],
    identity_visible: false,
    limit: 20,
    offset: 0,
    has_more: false,
    next_offset: null,
    ...overrides,
  };
}

describe('ProfileVisitorsComponent', () => {
  let fixture: ComponentFixture<ProfileVisitorsComponent>;
  let component: ProfileVisitorsComponent;
  let getMyVisitors: ReturnType<typeof vi.fn>;
  let currentUser: ReturnType<typeof signal<any>>;

  async function settle(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    currentUser = signal({ id: 'owner-1', is_vip: false });
    getMyVisitors = vi.fn().mockResolvedValue(makePage());

    await TestBed.configureTestingModule({
      imports: [ProfileVisitorsComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: ProfileVisitsService,
          useValue: { getMyVisitors },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileVisitorsComponent);
    component = fixture.componentInstance;
  });

  it('renders real visitor identities only when the server marks them visible', async () => {
    getMyVisitors.mockResolvedValueOnce(
      makePage({
        items: [makeVisit('visit-1', 'visitor-1')],
        identity_visible: true,
      }),
    );

    fixture.detectChanges();
    await settle();

    const link = fixture.nativeElement.querySelector('a.profile-visitor-item') as HTMLAnchorElement;
    expect(getMyVisitors).toHaveBeenCalledWith(20, 0);
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('/profile/visitor-1');
    expect(fixture.nativeElement.textContent).toContain('Visitor visit-1');
  });

  it('never renders a profile link when the canonical API masks identities', async () => {
    getMyVisitors.mockResolvedValueOnce(
      makePage({
        items: [
          {
            ...makeVisit('visit-1', 'hidden-vip-only'),
            is_blurred: true,
            visitor: {
              id: 'hidden-vip-only',
              display_name: 'Someone viewed your profile',
              avatar_url: null,
              native_languages: [],
              target_languages: [],
            },
          },
        ],
        identity_visible: false,
      }),
    );

    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.querySelector('a.profile-visitor-item')).toBeNull();
    expect(fixture.nativeElement.querySelector('.profile-visitors-overlay')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Someone viewed your profile');
  });

  it('shows a real error state with retry instead of mock visitor data', async () => {
    getMyVisitors.mockRejectedValueOnce(new Error('network failure'));

    fixture.detectChanges();
    await settle();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('common.error_generic');
    expect(component.visitors()).toEqual([]);

    getMyVisitors.mockResolvedValueOnce(
      makePage({ items: [makeVisit('visit-2')], identity_visible: true }),
    );
    component.retry();
    await settle();

    expect(getMyVisitors).toHaveBeenCalledTimes(2);
    expect(component.error()).toBe(false);
    expect(component.visitors()).toHaveLength(1);
  });

  it('loads subsequent bounded pages without duplicating rows', async () => {
    getMyVisitors
      .mockResolvedValueOnce(
        makePage({
          items: [makeVisit('visit-1')],
          identity_visible: true,
          has_more: true,
          next_offset: 20,
        }),
      )
      .mockResolvedValueOnce(
        makePage({
          items: [makeVisit('visit-1'), makeVisit('visit-2')],
          identity_visible: true,
          offset: 20,
          has_more: false,
          next_offset: null,
        }),
      );

    fixture.detectChanges();
    await settle();
    component.loadMore();
    await settle();

    expect(getMyVisitors).toHaveBeenNthCalledWith(2, 20, 20);
    expect(component.visitors().map((visit) => visit.id)).toEqual(['visit-1', 'visit-2']);
    expect(component.hasMore()).toBe(false);
  });

  it('announces loading politely before the first page arrives', async () => {
    getMyVisitors.mockReturnValue(new Promise(() => undefined));

    fixture.detectChanges();
    await settle();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('visitors.loading');
    expect(status.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a.profile-visitor-item')).toBeNull();
  });

  it('shows the empty state when nobody has visited', async () => {
    fixture.detectChanges();
    await settle();

    expect(fixture.nativeElement.querySelector('.profile-visitors-empty')?.textContent).toContain(
      'visitors.empty',
    );
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  describe('free-tier blurred cards', () => {
    function makeMaskedVisit(id: string): ProfileVisit {
      return {
        id,
        created_at: '2026-08-20T12:00:00.000Z',
        is_blurred: true,
        visitor: {
          id: 'hidden-vip-only',
          avatar_url: null,
          native_languages: [],
          target_languages: [],
        },
      };
    }

    beforeEach(() => {
      getMyVisitors.mockResolvedValueOnce(
        makePage({
          identity_visible: false,
          items: [makeMaskedVisit('visit-1'), makeMaskedVisit('visit-2'), makeMaskedVisit('visit-3')],
        }),
      );
    });

    it('renders one blurred masked card per visit, hidden from assistive technology', async () => {
      fixture.detectChanges();
      await settle();

      const maskedCards = fixture.nativeElement.querySelector(
        '.profile-visitors-masked-cards',
      ) as HTMLElement;
      expect(maskedCards.getAttribute('aria-hidden')).toBe('true');
      expect(maskedCards.classList.contains('blur-sm')).toBe(true);
      expect(maskedCards.classList.contains('pointer-events-none')).toBe(true);
      expect(maskedCards.querySelectorAll('.profile-visitor-masked-card')).toHaveLength(3);
      expect(maskedCards.textContent?.trim()).toBe('');
    });

    it('keeps the upgrade prompt outside the blurred region and readable', async () => {
      fixture.detectChanges();
      await settle();

      const overlay = fixture.nativeElement.querySelector('.profile-visitors-overlay') as HTMLElement;
      expect(overlay.closest('[aria-hidden="true"]')).toBeNull();
      expect(overlay.querySelector('h3')?.textContent).toContain('profile.upgradeTitle');
      expect(overlay.textContent).toContain('profile.upgradePrice');
      expect(overlay.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(overlay.querySelector('button')?.textContent).toContain('vip.seePlans');
    });

    it('sends free users to the plans page from the upgrade button', async () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      fixture.detectChanges();
      await settle();
      (fixture.nativeElement.querySelector('.profile-visitors-upgrade-btn') as HTMLButtonElement).click();

      expect(navigate).toHaveBeenCalledWith(['/subscription']);
    });

    it('does not expose any visitor identity, link or timestamp text while masked', async () => {
      fixture.detectChanges();
      await settle();

      expect(fixture.nativeElement.querySelector('a[href*="/profile/"]')).toBeNull();
      expect(fixture.nativeElement.innerHTML).not.toContain('hidden-vip-only');
      expect(fixture.nativeElement.querySelector('img')).toBeNull();
    });
  });

  it('styles rows with Relay semantic roles rather than inline fixed colours', async () => {
    getMyVisitors.mockResolvedValueOnce(
      makePage({ items: [makeVisit('visit-1')], identity_visible: true }),
    );

    fixture.detectChanges();
    await settle();

    const row = fixture.nativeElement.querySelector('a.profile-visitor-item') as HTMLElement;
    expect(row.classList.contains('bg-surface-300')).toBe(true);
    expect(row.classList.contains('border-surface-100')).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('.profile-visitor-name') as HTMLElement).classList.contains(
        'text-text-primary',
      ),
    ).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('[style]')).toHaveLength(0);
    expect(row.querySelector('time')?.getAttribute('datetime')).toBe('2026-08-20T12:00:00.000Z');
  });

  it('discards rows loaded under a different identity state when the entitlement changes', async () => {
    getMyVisitors
      .mockResolvedValueOnce(
        makePage({
          items: [makeVisit('visit-1')],
          identity_visible: true,
          has_more: true,
          next_offset: 20,
        }),
      )
      .mockResolvedValueOnce(
        makePage({
          items: [
            {
              id: 'visit-2',
              created_at: '2026-08-20T12:00:00.000Z',
              is_blurred: true,
              visitor: {
                id: 'hidden-vip-only',
                avatar_url: null,
                native_languages: [],
                target_languages: [],
              },
            },
          ],
          identity_visible: false,
          offset: 20,
        }),
      );

    fixture.detectChanges();
    await settle();
    component.loadMore();
    await settle();

    expect(component.identityVisible()).toBe(false);
    expect(component.visitors().map((visit) => visit.id)).toEqual(['visit-2']);
    expect(fixture.nativeElement.textContent).not.toContain('Visitor visit-1');
    expect(fixture.nativeElement.querySelector('a.profile-visitor-item')).toBeNull();
  });

  it('disables and labels the load-more button while the next page is loading', async () => {
    getMyVisitors
      .mockResolvedValueOnce(
        makePage({
          items: [makeVisit('visit-1')],
          identity_visible: true,
          has_more: true,
          next_offset: 20,
        }),
      )
      .mockReturnValueOnce(new Promise(() => undefined));

    fixture.detectChanges();
    await settle();

    const button = fixture.nativeElement.querySelector(
      '.profile-visitors-load-more',
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('events.load_more');
    expect(button.disabled).toBe(false);

    component.loadMore();
    await settle();

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('visitors.loading');
  });

  it('keeps loaded rows and offers retry when a later page fails', async () => {
    getMyVisitors
      .mockResolvedValueOnce(
        makePage({
          items: [makeVisit('visit-1')],
          identity_visible: true,
          has_more: true,
          next_offset: 20,
        }),
      )
      .mockRejectedValueOnce(new Error('page two unavailable'));

    fixture.detectChanges();
    await settle();
    component.loadMore();
    await settle();

    expect(component.visitors()).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('a.profile-visitor-item')).toBeTruthy();
    const inline = fixture.nativeElement.querySelector('.profile-visitors-inline-error');
    expect(inline?.getAttribute('role')).toBe('alert');
    expect(inline?.textContent).toContain('common.error_generic');
    expect(fixture.nativeElement.querySelector('.profile-visitors-load-more')).toBeNull();
  });
});
