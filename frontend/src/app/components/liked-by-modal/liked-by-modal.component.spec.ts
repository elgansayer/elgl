import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LikedByModalComponent } from './liked-by-modal.component';

interface LikedUser {
  id: string;
  avatar_url: string | null;
  display_name: string;
  native_languages?: string[];
  target_languages: string[];
}

function flushRequest(httpTesting: HttpTestingController, users: LikedUser[] = []): void {
  httpTesting.expectOne('/api/moments/moment-123/likes').flush(users);
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
    httpTesting.verify();
  });

  it('creates with an instance-safe dialog title relationship', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.dialogTitleId).toMatch(
      /^liked-by-title-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-labelledby')).toBe(component.dialogTitleId);
    expect(fixture.nativeElement.querySelector(`#${component.dialogTitleId}`)).toBeTruthy();
    flushRequest(httpTesting);
  });

  it('shows an accessible loading state while fetching likes', () => {
    fixture.detectChanges();

    expect(component.likedUsers.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeTruthy();
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

    const rows = fixture.nativeElement.querySelectorAll('li');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Alice');
    expect(fixture.nativeElement.textContent).toContain('Bob');
    expect(fixture.nativeElement.textContent).toContain('EN');
    expect(fixture.nativeElement.textContent).toContain('ES');

    const images = fixture.nativeElement.querySelectorAll('img');
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
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('No likes yet');
  });

  it('shows an alert and lets the user retry a failed request', async () => {
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/moments/moment-123/likes')
      .flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.error()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();

    const retry = fixture.nativeElement.querySelector('[data-testid="liked-by-retry"]');
    expect(retry).toBeTruthy();
    expect(retry.getAttribute('type')).toBe('button');
    retry.click();

    httpTesting.expectOne('/api/moments/moment-123/likes').flush([]);
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
    const closeButton = fixture.nativeElement.querySelector('[data-testid="liked-by-close"]');

    expect(closeButton).toBeTruthy();
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

    const req = httpTesting.expectOne('/api/moments/moment-456/likes');
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
