import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import {
  GroupParticipant,
  GroupParticipantDrawerComponent,
} from './group-participant-drawer.component';

describe('GroupParticipantDrawerComponent', () => {
  let fixture: ComponentFixture<GroupParticipantDrawerComponent>;
  let component: GroupParticipantDrawerComponent;

  const translations: Record<string, string> = {
    'group.participants': 'Participants',
    'group.noParticipants': 'No participants',
    'common.close': 'Close',
    'discovery.vipBadge': 'VIP',
  };

  const participants: GroupParticipant[] = [
    {
      id: 'user-1',
      display_name: 'Aiko',
      avatar_url: 'https://example.test/aiko.jpg',
      native_language: 'Japanese',
      target_languages: ['English'],
      is_vip: true,
    },
    {
      id: 'user-2',
      display_name: 'Sam',
      native_language: 'English',
      target_languages: ['Spanish'],
      is_vip: false,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupParticipantDrawerComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => translations[key] ?? key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupParticipantDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function openDrawer(items: GroupParticipant[] = participants): void {
    fixture.componentRef.setInput('participants', items);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  }

  it('does not render the modal surface while closed', () => {
    expect(fixture.debugElement.query(By.css('[role="dialog"]'))).toBeNull();
  });

  it('renders the participant count and group member metadata', () => {
    openDrawer();

    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    const headings = fixture.debugElement.queryAll(By.css('h3'));

    expect(dialog).not.toBeNull();
    expect(dialog.nativeElement.getAttribute('aria-modal')).toBe('true');
    expect(dialog.nativeElement.getAttribute('aria-label')).toBe('Participants');
    expect(fixture.nativeElement.textContent).toContain('Participants (2)');
    expect(headings.map((heading) => heading.nativeElement.textContent.trim())).toEqual([
      'Aiko',
      'Sam',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Japanese');
    expect(fixture.nativeElement.textContent).toContain('English');
    expect(fixture.nativeElement.textContent).toContain('Spanish');
    expect(fixture.nativeElement.textContent).toContain('VIP');
  });

  it('renders an honest empty state when the group has no participants', () => {
    openDrawer([]);

    expect(fixture.nativeElement.textContent).toContain('Participants (0)');
    expect(fixture.nativeElement.textContent).toContain('No participants');
    expect(fixture.debugElement.queryAll(By.css('h3'))).toHaveLength(0);
  });

  it('emits close when the labelled Spartan close action is activated', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);
    openDrawer();

    const closeButton = fixture.debugElement.query(By.css('button[data-slot="button"]'));

    expect(closeButton).not.toBeNull();
    expect(closeButton.nativeElement.getAttribute('aria-label')).toBe('Close');
    closeButton.nativeElement.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('emits close when the modal backdrop is activated', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);
    openDrawer();

    const backdrop = fixture.debugElement.query(By.css('div[role="presentation"]'));

    expect(backdrop).not.toBeNull();
    backdrop.nativeElement.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });
});
