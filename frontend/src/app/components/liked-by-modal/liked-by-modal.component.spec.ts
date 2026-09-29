import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LikedByModalComponent } from './liked-by-modal.component';
import { environment } from '../../../environments/environment';

interface LikedUser {
  id: string;
  avatar_url: string | null;
  display_name: string;
  native_languages?: string[];
  target_languages: string[];
}

const likesUrl = (momentId: string): string => `${environment.apiUrl}/moments/${momentId}/likes`;

function flushRequest(httpTesting: HttpTestingController, users: LikedUser[] = []): void {
  httpTesting.expectOne(likesUrl('moment-123')).flush(users);
}

function getDialog(): HTMLElement {
  const title = document.body.querySelector<HTMLElement>('[data-testid="liked-by-title"]');
  const dialog = title?.closest<HTMLElement>('[role="dialog"]');
  if (!dialog) {
    throw new Error('Expected the Liked By dialog to be rendered in the document overlay');
  }
  return dialog;
}

describe('LikedByModalComponent', () => {
  let component: LikedByModalComponent;
  let fixture: ComponentFixture<LikedByModalComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LikedByModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LikedByModalComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('momentId', 'moment-123');
  });

  afterEach(() => {
    try {
      httpTesting?.verify();
    } finally {
      fixture?.destroy();
    }
  });

  it('creates with an instance-safe dialog title relationship', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    const dialog = getDialog();
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toMatch(/^brn-dialog-title-\d+$/);
    expect(dialog.querySelector(`#${titleId}`)?.getAttribute('data-testid')).toBe('liked-by-title');
    flushRequest(httpTesting);
  });

  it('shows an accessible loading state while fetching likes', () => {
    fixture.detectChanges();

    expect(component.likedUsers.isLoading()).toBe(true);
    expect(getDialog().querySelector('[role="progressbar"]')).toBeTruthy();
    flushRequest(httpTesting);
  });

  it('lists every returned liker with language metadata and decorative avatars', async () => {
    fixture.detectChanges();
    const mockUsers: LikedUser[] = [
      {
        id: 'user-1',
        display_name: 'Alice',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: ['es', 'fr'],
      },
      {
        id: 'user-2',
        display_name: 'Bob',
        avatar_url: 'https://example.com/avatar.jpg',
        native_languages: ['fr'],
        target_languages: ['en'],
      },
    ];

    flushRequest(httpTesting, mockUsers);
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = getDialog();
    const rows = dialog.querySelectorAll('li');
    expect(rows.length).toBe(2);
    expect(dialog.textContent).toContain('Alice');
    expect(dialog.textContent).toContain('Bob');
    expect(dialog.textContent).toContain('EN');
    expect(dialog.textContent).toContain('ES');

    const images = dialog.querySelectorAll('img');
    expect(images[0].getAttribute('src')).toContain('default-avatar.png');
    expect(images[0].getAttribute('alt')).toBe('');
    expect(images[1].getAttribute('src')).toBe('https://example.com/avatar.jpg');
    expect(images[1].getAttribute('alt')).toBe('');
    expect(rows[0].querySelector('[dir="auto"]')?.textContent).toContain('Alice');
  });

  it('renders the honest empty state when the Moment has no likes', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.value()).toEqual([]);
    const dialog = getDialog();
    expect(dialog.querySelectorAll('li').length).toBe(1);
    expect(dialog.textContent).toContain('No likes yet');
  });

  it('shows an alert and lets the user retry a failed request', async () => {
    fixture.detectChanges();
    httpTesting
      .expectOne(likesUrl('moment-123'))
      .flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.error()).toBeTruthy();
    const dialog = getDialog();
    expect(dialog.querySelector('[role="alert"]')).toBeTruthy();

    const retry = dialog.querySelector<HTMLButtonElement>('[data-testid="liked-by-retry"]');
    if (!retry) {
      throw new Error('Expected the Liked By retry action to be rendered');
    }
    expect(retry.getAttribute('type')).toBe('button');
    retry.click();
    fixture.detectChanges();

    httpTesting.expectOne(likesUrl('moment-123')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.error()).toBeFalsy();
    expect(component.likedUsers.value()).toEqual([]);
  });

  it('emits closeModal from the labelled Spartan close action', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();
    fixture.detectChanges();

    const closeSpy = vi.fn();
    const subscription = component.closeModal.subscribe(closeSpy);
    const closeButton = getDialog().querySelector<HTMLButtonElement>(
      '[data-testid="liked-by-close"]',
    );

    if (!closeButton) {
      throw new Error('Expected the Liked By close action to be rendered');
    }
    expect(closeButton.getAttribute('type')).toBe('button');
    expect(closeButton.getAttribute('aria-label')).toBeTruthy();
    closeButton.click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('emits closeModal for dialog-originated dismissal while controlled open', () => {
    const closeSpy = vi.fn();
    const subscription = component.closeModal.subscribe(closeSpy);

    component.onDialogStateChanged('closed');

    expect(closeSpy).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('does not emit a duplicate close after the parent closes the modal', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    httpTesting.expectNone(likesUrl('moment-123'));
    const closeSpy = vi.fn();
    const subscription = component.closeModal.subscribe(closeSpy);

    component.onDialogStateChanged('closed');

    expect(closeSpy).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('refetches the liker list when momentId changes', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();

    fixture.componentRef.setInput('momentId', 'moment-456');
    fixture.detectChanges();

    const req = httpTesting.expectOne(likesUrl('moment-456'));
    req.flush([
      {
        id: 'user-2',
        display_name: 'Bob',
        avatar_url: null,
        native_languages: ['fr'],
        target_languages: ['en'],
      },
    ] satisfies LikedUser[]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.value()).toHaveLength(1);
    expect(component.likedUsers.value()?.[0].display_name).toBe('Bob');
  });
});
