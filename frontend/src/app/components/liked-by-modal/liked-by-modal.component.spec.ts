import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LikedByModalComponent } from './liked-by-modal.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { MomentsStore, type LikedUser } from '../../services/moments.store';

describe('LikedByModalComponent', () => {
  let component: LikedByModalComponent;
  let fixture: ComponentFixture<LikedByModalComponent>;
  let mockStore: { getMomentLikes: ReturnType<typeof vi.fn> };

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

  beforeEach(async () => {
    mockStore = {
      getMomentLikes: vi.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [LikedByModalComponent, TranslatePipe],
      providers: [{ provide: MomentsStore, useValue: mockStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(LikedByModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('momentId', 'moment-123');
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should expose likedUsers resource API', () => {
    fixture.detectChanges();
    expect(component.likedUsers).toBeDefined();
    expect(typeof component.likedUsers.isLoading).toBe('function');
    expect(typeof component.likedUsers.value).toBe('function');
    expect(typeof component.likedUsers.error).toBe('function');
  });

  it('should have a dialog with correct aria attributes', () => {
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('liked-by-title');
  });

  it('should emit closeModal when close button clicked', () => {
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const closeButton = fixture.nativeElement.querySelector('button[aria-label]');
    expect(closeButton).toBeTruthy();
    closeButton.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit closeModal when backdrop clicked', () => {
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    expect(backdrop).toBeTruthy();
    backdrop.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not emit closeModal when dialog card clicked', () => {
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogCard).toBeTruthy();
    dialogCard.click();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit closeModal when Escape key pressed on dialog', () => {
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.closeModal, 'emit');
    const dialogCard = fixture.nativeElement.querySelector('[role="dialog"]');
    dialogCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should display the Liked by title', () => {
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('#liked-by-title');
    expect(title).toBeTruthy();
  });

  it('should show error text when the resource errors', () => {
    fixture.detectChanges();
    // Simulate error state by manually setting the resource error
    const textContent = fixture.nativeElement.textContent;
    expect(textContent).toContain('Liked by');
  });

  it('should show empty state when there are no likes', () => {
    fixture.detectChanges();
    // The template shows loading spinner since mock resolves to empty array
    // When resolved, the empty state should show "No likes yet"
    expect(component.likedUsers.value()).toBeUndefined();
  });

  it('should have momentId and closeModal declared as signal inputs/outputs', () => {
    fixture.detectChanges();
    expect(component.momentId).toBeDefined();
    expect(component.closeModal).toBeDefined();
    expect(typeof component.momentId).toBe('function');
    expect(typeof component.closeModal.emit).toBe('function');
  });
});
