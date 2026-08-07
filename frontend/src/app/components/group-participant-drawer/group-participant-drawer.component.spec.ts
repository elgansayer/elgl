import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GroupParticipantDrawerComponent } from './group-participant-drawer.component';
import { GroupMember } from '../../services/chat.service';

const mockMembers: GroupMember[] = [
  {
    user_id: 'user-1',
    user: {
      id: 'user-1',
      display_name: 'Alice',
      avatar_url: 'https://example.com/avatar1.jpg',
    },
  },
  {
    user_id: 'user-2',
    user: {
      id: 'user-2',
      display_name: 'Bob',
      avatar_url: null,
    },
  },
];

describe('GroupParticipantDrawerComponent', () => {
  let fixture: ComponentFixture<GroupParticipantDrawerComponent>;
  let component: GroupParticipantDrawerComponent;

  beforeAll(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupParticipantDrawerComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GroupParticipantDrawerComponent);
    component = fixture.componentInstance;
  });

  it('is created', () => {
    expect(component).toBeTruthy();
  });

  it('does not render dialog when isOpen is false', () => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.componentRef.setInput('participants', []);
    fixture.detectChanges();

    const drawer = fixture.debugElement.query(By.css('[role="dialog"]'));
    expect(drawer).toBeFalsy();
  });

  it('renders dialog when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', mockMembers);
    fixture.detectChanges();

    const drawer = fixture.debugElement.query(By.css('[role="dialog"]'));
    expect(drawer).toBeTruthy();
  });

  it('renders participant names', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', mockMembers);
    fixture.detectChanges();

    const rootText = fixture.nativeElement.textContent;
    expect(rootText).toContain('Alice');
    expect(rootText).toContain('Bob');
  });

  it('shows avatar img when avatar_url is set', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', [mockMembers[0]]);
    fixture.detectChanges();

    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.attributes['src']).toBe('https://example.com/avatar1.jpg');
  });

  it('shows initial letter fallback when no avatar_url', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', [mockMembers[1]]);
    fixture.detectChanges();

    const rootText = fixture.nativeElement.textContent;
    expect(rootText).toContain('B');
  });

  it('shows unknown user fallback when user data is null', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', [{ user_id: 'u3', user: null }]);
    fixture.detectChanges();

    const rootText = fixture.nativeElement.textContent;
    expect(rootText).toContain('?');
  });

  it('emits closed when backdrop is clicked', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', mockMembers);
    fixture.detectChanges();

    let emitted = false;
    const sub = component.closed.subscribe(() => (emitted = true));

    const backdrop = fixture.debugElement.query(By.css('.fixed.inset-0.bg-black'));
    expect(backdrop).toBeTruthy();
    backdrop.triggerEventHandler('click', null);

    expect(emitted).toBe(true);
    sub.unsubscribe();
  });

  it('emits closed when close button is clicked', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('participants', mockMembers);
    fixture.detectChanges();

    let emitted = false;
    const sub = component.closed.subscribe(() => (emitted = true));

    const closeBtn = fixture.debugElement.query(By.css('button'));
    expect(closeBtn).toBeTruthy();
    closeBtn.triggerEventHandler('click', null);

    expect(emitted).toBe(true);
    sub.unsubscribe();
  });
});