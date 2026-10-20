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

  it('renders a custom icon for the profileUpdated event', () => {
    fixture.componentRef.setInput('eventType', 'profileUpdated');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toContain('\ud83d\udc64');
  });

  it('renders a custom icon for the missedCall event', () => {
    fixture.componentRef.setInput('eventType', 'missedCall');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toContain('\ud83d\udcde');
  });

  it('uses default config for unknown event types', () => {
    fixture.componentRef.setInput('eventType', 'unknownEventType');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toContain('\ud83d\udd14');
  });

  it('applies custom styling for profileUpdated event', () => {
    fixture.componentRef.setInput('eventType', 'profileUpdated');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('span.rounded-full');
    expect(span.className).toContain('bg-secondary/10');
    expect(span.className).toContain('border-secondary/30');
    expect(span.className).toContain('text-secondary');
  });

  it('applies custom styling for missedCall event', () => {
    fixture.componentRef.setInput('eventType', 'missedCall');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('span.rounded-full');
    expect(span.className).toContain('bg-danger/10');
    expect(span.className).toContain('border-danger/30');
    expect(span.className).toContain('text-danger');
  });

  it('applies default styling for unknown event types', () => {
    fixture.componentRef.setInput('eventType', 'unknownEventType');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('span.rounded-full');
    expect(span.className).toContain('bg-surface-200');
    expect(span.className).toContain('border-surface-100');
    expect(span.className).toContain('text-text-secondary');
  });
});
