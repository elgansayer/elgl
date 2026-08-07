import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatSystemBubbleComponent } from './chat-system-bubble.component';

describe('ChatSystemBubbleComponent', () => {
  let fixture: ComponentFixture<ChatSystemBubbleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatSystemBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatSystemBubbleComponent);
  });

  it('should create', () => {
    fixture.componentRef.setInput('eventType', 'memberRemoved');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('derives the i18n key by namespacing eventType under "system."', () => {
    fixture.componentRef.setInput('eventType', 'groupRenamed');
    expect(fixture.componentInstance.i18nKey()).toBe('system.groupRenamed');
  });

  it('renders the translated, interpolated text for the given event and params', () => {
    fixture.componentRef.setInput('eventType', 'groupRenamed');
    fixture.componentRef.setInput('params', { name: 'Language Buddies' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Language Buddies');
  });

  it('interpolates count params for the memberAdded event', () => {
    fixture.componentRef.setInput('eventType', 'memberAdded');
    fixture.componentRef.setInput('params', { count: 3 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('falls back to an empty params object when none is provided', () => {
    fixture.componentRef.setInput('eventType', 'memberRemoved');
    fixture.detectChanges();

    expect(fixture.componentInstance.params()).toEqual({});
    expect(fixture.nativeElement.textContent).toContain('member left the group');
  });

  it('exposes the bubble as a status region for assistive technology', () => {
    fixture.componentRef.setInput('eventType', 'memberRemoved');
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
  });
});
