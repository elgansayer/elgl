import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  GroupParticipantDrawerComponent,
  GroupParticipant,
} from './group-participant-drawer.component';
import { I18nService } from '../../services/i18n.service';

const mockParticipants: GroupParticipant[] = [
  {
    id: 'user-1',
    display_name: 'Alice',
    avatar_url: 'https://example.com/avatar1.jpg',
    native_language: 'English',
    target_languages: ['Spanish', 'French'],
    is_vip: true,
  },
  {
    id: 'user-2',
    display_name: 'Bob',
    avatar_url: undefined,
    native_language: 'French',
    target_languages: ['English'],
    is_vip: false,
  },
  {
    id: 'user-3',
    display_name: 'Charlie',
    avatar_url: 'https://example.com/avatar3.jpg',
    native_language: 'German',
    target_languages: ['Japanese', 'Korean', 'Chinese'],
    is_vip: false,
  },
];

describe.skip('GroupParticipantDrawerComponent', () => {
  let fixture: ComponentFixture<GroupParticipantDrawerComponent>;
  let component: GroupParticipantDrawerComponent;
  let closedSpy: ReturnType<typeof vi.fn>;

  function setUp(overrides?: { isOpen?: boolean; participants?: GroupParticipant[] }): void {
    fixture = TestBed.createComponent(GroupParticipantDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', overrides?.isOpen ?? true);
    fixture.componentRef.setInput('participants', overrides?.participants ?? mockParticipants);
    closedSpy = vi.fn();
    component.closed.subscribe(() => (closedSpy as any)());
    fixture.detectChanges();
  }

  beforeEach(async () => {
    const i18nMock = {
      translate: (key: string, params?: Record<string, unknown>) => {
        if (key === 'group.participants') {
          return `Participants (${params?.['count'] ?? 0})`;
        }
        if (key === 'group.noParticipants') return 'No participants';
        if (key === 'discovery.vipBadge') return 'VIP';
        return key;
      },
      translations: signal({}),
    };

    await TestBed.configureTestingModule({
      imports: [GroupParticipantDrawerComponent],
      providers: [{ provide: I18nService, useValue: i18nMock }],
    }).compileComponents();
  });

  it('should create and render the drawer when open', () => {
    setUp();
    expect(fixture.nativeElement.querySelector('h2')).toBeTruthy();
  });

  it('should display the participant count in the header', () => {
    setUp();
    const headerEl = fixture.nativeElement.querySelector('h2');
    expect(headerEl).toBeTruthy();
    expect(headerEl!.textContent).toContain('Participants (3)');
  });

  it('should render all participant items', () => {
    setUp();
    const participantCards = fixture.nativeElement.querySelectorAll('.rounded-xl');
    expect(participantCards.length).toBe(3);
  });

  it('should display VIP badge for VIP users', () => {
    setUp();
    const vipBadges = fixture.nativeElement.querySelectorAll('.bg-vip');
    expect(vipBadges.length).toBe(1);
  });

  it('should show fallback initial for users without avatar', () => {
    setUp();
    const fallbackIcons = fixture.nativeElement.querySelectorAll('.bg-surface-100');
    expect(fallbackIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('should emit closed event when close button is clicked', () => {
    setUp();
    const closeButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'button[aria-label="Close drawer"]',
    );
    expect(closeButton).toBeTruthy();
    closeButton!.click();
    fixture.detectChanges();
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit closed event when backdrop is clicked', () => {
    setUp();
    const backdrop: HTMLElement | null = fixture.nativeElement.querySelector('.fixed.inset-0.z-40');
    expect(backdrop).toBeTruthy();
    backdrop!.click();
    fixture.detectChanges();
    expect(closedSpy).toHaveBeenCalledTimes(1);
  });

  it('should hide the drawer panel content when isOpen is false', () => {
    setUp({ isOpen: false });
    const panel = fixture.nativeElement.querySelector('.fixed.inset-y-0.end-0');
    expect(panel).toBeTruthy();
    expect(panel!.classList.contains('translate-x-full')).toBe(true);
  });

  it('should show empty state when no participants', () => {
    setUp({ participants: [] });
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('No participants');
  });

  it('should use logical CSS properties for RTL support', () => {
    setUp();
    const drawerPanel = fixture.nativeElement.querySelector('.fixed.inset-y-0.end-0');
    expect(drawerPanel).toBeTruthy();
    expect(drawerPanel!.classList.contains('border-s')).toBe(true);
  });

  it('should display language pair info for each participant', () => {
    setUp();
    const langEls = fixture.nativeElement.querySelectorAll('.text-secondary');
    expect(langEls.length).toBe(3);
  });
});
