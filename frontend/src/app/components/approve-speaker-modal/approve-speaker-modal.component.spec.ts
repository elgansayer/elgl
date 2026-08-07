import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ApproveSpeakerModalComponent,
  RaisedHandRequest,
} from './approve-speaker-modal.component';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

describe('ApproveSpeakerModalComponent', () => {
  let fixture: ComponentFixture<ApproveSpeakerModalComponent>;
  let component: ApproveSpeakerModalComponent;
  let mockStore: Partial<AudioRoomsStore>;
  let mockI18n: Partial<I18nService>;
  let closedEmitted: boolean;

  const createRequests = (count: number): RaisedHandRequest[] =>
    Array.from({ length: count }, (_, i) => ({
      userId: `user-${i}`,
      displayName: `User ${i}`,
      avatarUrl: i === 0 ? 'https://example.com/avatar.jpg' : null,
    }));

  beforeEach(async () => {
    closedEmitted = false;
    mockStore = {
      approveSpeaker: vi.fn().mockResolvedValue(undefined),
      dismissRaisedHand: vi.fn().mockResolvedValue(undefined),
    };
    mockI18n = {
      translate: vi.fn((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [ApproveSpeakerModalComponent],
      providers: [
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApproveSpeakerModalComponent);
    component = fixture.componentInstance;
  });

  const initWithRequests = (requests: RaisedHandRequest[]): void => {
    fixture.componentRef.setInput('requests', requests);
    component.closed.subscribe(() => {
      closedEmitted = true;
    });
    fixture.detectChanges();
  };

  it('should create', () => {
    initWithRequests([]);
    expect(component).toBeTruthy();
  });

  it('should show empty state when no requests', () => {
    initWithRequests([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('approveSpeakerModal.emptyState');
  });

  it('should render all requests', () => {
    const requests = createRequests(3);
    initWithRequests(requests);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.rounded-2xl').length).toBe(3);
    expect(el.textContent).toContain('User 0');
    expect(el.textContent).toContain('User 1');
    expect(el.textContent).toContain('User 2');
  });

  it('should show avatar when available and fallback initial when not', () => {
    const requests = createRequests(2);
    initWithRequests(requests);
    const el = fixture.nativeElement as HTMLElement;
    const imgs = el.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toBe('https://example.com/avatar.jpg');
    // Second user has no avatar, should show a div with initial
    const initials = el.querySelectorAll('.bg-amber-500\\/20');
    expect(initials.length).toBe(1);
    expect(initials[0].textContent?.trim()).toBe('U');
  });

  it('should emit closed when close button clicked', () => {
    initWithRequests(createRequests(1));
    const el = fixture.nativeElement as HTMLElement;
    const closeBtn = el.querySelector('[aria-label="Close"]') as HTMLButtonElement;
    closeBtn.click();
    expect(closedEmitted).toBe(true);
  });

  it('should call approveSpeaker on store when approve clicked', async () => {
    initWithRequests(createRequests(1));
    const el = fixture.nativeElement as HTMLElement;
    const approveBtn = el.querySelector('.bg-emerald-600') as HTMLButtonElement;
    approveBtn.click();
    await fixture.whenStable();
    expect(mockStore.approveSpeaker).toHaveBeenCalledWith('user-0');
  });

  it('should call dismissRaisedHand on store when dismiss clicked', () => {
    initWithRequests(createRequests(1));
    const el = fixture.nativeElement as HTMLElement;
    const dismissBtn = el.querySelector('.bg-surface-100') as HTMLButtonElement;
    dismissBtn.click();
    expect(mockStore.dismissRaisedHand).toHaveBeenCalledWith('user-0');
  });

  it('should disable buttons after processing', () => {
    initWithRequests(createRequests(2));
    const el = fixture.nativeElement as HTMLElement;
    const approveBtn = el.querySelector('.bg-emerald-600') as HTMLButtonElement;
    approveBtn.click();
    fixture.detectChanges();
    // Button should get disabled state
    const allApproveBtns = el.querySelectorAll('.bg-emerald-600');
    expect((allApproveBtns[0] as HTMLButtonElement).disabled).toBe(true);
    expect((allApproveBtns[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('should show done button when there are requests', () => {
    initWithRequests(createRequests(1));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('approveSpeakerModal.doneBtn');
  });

  it('should not show done button when no requests', () => {
    initWithRequests([]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('approveSpeakerModal.doneBtn');
  });

  it('should emit closed when done clicked', () => {
    initWithRequests(createRequests(1));
    const el = fixture.nativeElement as HTMLElement;
    const doneBtn = el.querySelector('button:not([aria-label])') as HTMLButtonElement;
    // Find the done button by text content
    const buttons = Array.from(el.querySelectorAll('button'));
    const foundDone = buttons.find(
      (b) => b.textContent?.includes('approveSpeakerModal.doneBtn'),
    ) as HTMLButtonElement;
    foundDone.click();
    expect(closedEmitted).toBe(true);
  });
});