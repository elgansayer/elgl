import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
});
