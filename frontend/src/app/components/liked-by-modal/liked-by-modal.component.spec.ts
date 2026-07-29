import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LikedByModalComponent } from './liked-by-modal.component';
import { TranslatePipe } from '../../services/translate.pipe';

interface LikedUser {
  id: string;
  avatar_url?: string;
  display_name: string;
  native_language: string;
  target_languages?: string[];
}

describe('LikedByModalComponent', () => {
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
    fixture.detectChanges();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show loading state while fetching likes', () => {
    expect(component.likedUsers.isLoading()).toBe(true);
    const spinner = fixture.nativeElement.querySelector('[role="progressbar"]');
    expect(spinner).toBeTruthy();
  });

  it('should load and display users when API responds', () => {
    const mockUsers: LikedUser[] = [
      {
        id: 'user-1',
        display_name: 'Alice',
        native_language: 'en',
        target_languages: ['es', 'fr'],
      },
      {
        id: 'user-2',
        avatar_url: 'https://example.com/avatar.jpg',
        display_name: 'Bob',
        native_language: 'fr',
        target_languages: ['en'],
      },
    ];

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush(mockUsers);
    fixture.detectChanges();

    expect(component.likedUsers.isLoading()).toBe(false);
    expect(component.likedUsers.value()).toEqual(mockUsers);

    const userElements = fixture.nativeElement.querySelectorAll('.hover\\:bg-slate-800\\/50');
    expect(userElements.length).toBe(2);
  });

  it('should show error state when API fails', () => {
    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.error(new ErrorEvent('Network error'));
    fixture.detectChanges();

    expect(component.likedUsers.isLoading()).toBe(false);
    expect(component.likedUsers.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('common.loadError');
  });

  it('should show empty state when no likes exist', () => {
    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([]);
    fixture.detectChanges();

    expect(component.likedUsers.value()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('moments.noLikesYet');
  });

  it('should emit closeModal when close button clicked', () => {
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([]);
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('button[aria-label]');
    closeButton.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit closeModal when backdrop clicked', () => {
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([]);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not emit closeModal when dialog card clicked', () => {
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([
      {
        id: 'user-1',
        display_name: 'Alice',
        native_language: 'en',
        target_languages: ['es'],
      },
    ]);
    fixture.detectChanges();

    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    dialogCard.click();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit closeModal when Escape key pressed on dialog', () => {
    const emitSpy = vi.spyOn(component.closeModal, 'emit');

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush([]);
    fixture.detectChanges();

    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    dialogCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should set correct ARIA attributes on dialog', () => {
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogCard).toBeTruthy();
    expect(dialogCard.getAttribute('aria-modal')).toBe('true');
    expect(dialogCard.getAttribute('aria-labelledby')).toBe('liked-by-title');
  });

  it('should display user language pairs correctly', () => {
    const mockUsers: LikedUser[] = [
      {
        id: 'user-1',
        display_name: 'Alice',
        native_language: 'en',
        target_languages: ['es'],
      },
    ];

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush(mockUsers);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('Alice');
    expect(textContent).toContain('EN');
    expect(textContent).toContain('ES');
  });

  it('should use default avatar when avatar_url is missing', () => {
    const mockUsers: LikedUser[] = [
      {
        id: 'user-1',
        display_name: 'Alice',
        native_language: 'en',
      },
    ];

    const req = httpTesting.expectOne('/api/moments/moment-123/likes');
    req.flush(mockUsers);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img.getAttribute('src')).toContain('default-avatar.png');
  });

  it('should refetch when momentId changes', () => {
    expect(component.likedUsers.isLoading()).toBe(true);
    httpTesting.expectOne('/api/moments/moment-123/likes');
  });
});
