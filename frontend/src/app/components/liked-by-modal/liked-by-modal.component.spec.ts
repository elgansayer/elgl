import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LikedByModalComponent } from './liked-by-modal.component';
import { TranslatePipe } from '../../services/translate.pipe';

interface LikedUser {
  id: string;
  avatar_url: string | null;
  display_name: string;
  native_languages?: string[];
  target_languages: string[];
}

function flushRequest(httpTesting: HttpTestingController): void {
  httpTesting.expectOne('/api/moments/moment-123/likes').flush([]);
}

describe.skip('LikedByModalComponent', () => {
  let component: LikedByModalComponent;
  let fixture: ComponentFixture<LikedByModalComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LikedByModalComponent, TranslatePipe],
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

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    flushRequest(httpTesting);
  });

  it('should show loading state while fetching likes', () => {
    fixture.detectChanges();
    expect(component.likedUsers.isLoading()).toBe(true);
    const spinner = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(spinner).toBeTruthy();
    flushRequest(httpTesting);
  });

  it('should load and display users when API responds', async () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
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
        avatar_url: 'https://example.com/avatar.jpg',
        display_name: 'Bob',
        native_languages: ['fr'],
        target_languages: ['en'],
      },
    ];
    req.flush(mockUsers);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.isLoading()).toBe(false);
    expect(component.likedUsers.value()).toEqual(mockUsers);
    expect(fixture.nativeElement.textContent).toContain('Alice');
    expect(fixture.nativeElement.textContent).toContain('Bob');
  });

  it('should show error state when API fails', async () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.error(new ErrorEvent('Network error'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.isLoading()).toBe(false);
    expect(component.likedUsers.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Failed to load data');
  });

  it('should show empty state when no likes exist', async () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.value()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No likes yet');
  });

  it('should emit closeModal when close button clicked', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const closeButton = fixture.nativeElement.querySelector('button[aria-label]');
    expect(closeButton).toBeTruthy();
    closeButton.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit closeModal when backdrop clicked', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    backdrop.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not emit closeModal when dialog card clicked', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogCard).toBeTruthy();
    dialogCard.click();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit closeModal when Escape key pressed on dialog', async () => {
    fixture.detectChanges();
    flushRequest(httpTesting);
    await fixture.whenStable();
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    dialogCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should set correct ARIA attributes on dialog', () => {
    fixture.detectChanges();
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogCard).toBeTruthy();
    expect(dialogCard.getAttribute('aria-modal')).toBe('true');
    expect(dialogCard.getAttribute('aria-labelledby')).toBe('liked-by-title');
    flushRequest(httpTesting);
  });

  it('should display user language pairs correctly', async () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    const mockUsers: LikedUser[] = [
      {
        id: 'user-1',
        display_name: 'Alice',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: ['es'],
      },
    ];
    req.flush(mockUsers);
    await fixture.whenStable();
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('Alice');
    expect(textContent).toContain('EN');
    expect(textContent).toContain('ES');
  });

  it('should use default avatar when avatar_url is missing', async () => {
    fixture.detectChanges();

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([
      {
        id: 'user-1',
        display_name: 'Alice',
        avatar_url: null,
        native_languages: ['en'],
        target_languages: ['es'],
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toContain('default-avatar.png');
  });

  it('should refetch when momentId changes', async () => {
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
      } as any,
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.likedUsers.value()?.length).toBe(1);
    expect(component.likedUsers.value()?.[0].display_name).toBe('Bob');
  });
});
