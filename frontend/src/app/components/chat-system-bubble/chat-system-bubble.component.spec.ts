import { beforeEach, describe, expect, it } from 'vitest';
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

  it('uses the system namespace for a complete known event', () => {
    fixture.componentRef.setInput('eventType', 'groupRenamed');
    fixture.componentRef.setInput('params', { name: 'Language Buddies' });

    expect(fixture.componentInstance.i18nKey()).toBe('system.groupRenamed');
  });

  it('renders translated, interpolated text for the given event and params', () => {
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

  it('renders events that do not require interpolation params', () => {
    fixture.componentRef.setInput('eventType', 'memberRemoved');
    fixture.detectChanges();

    expect(fixture.componentInstance.params()).toEqual({});
    expect(fixture.componentInstance.i18nKey()).toBe('system.memberRemoved');
    expect(fixture.nativeElement.textContent).toContain('member left the group');
  });

  it('normalizes surrounding whitespace on known event types before rendering', () => {
    fixture.componentRef.setInput('eventType', '  missedCall  ');
    fixture.componentRef.setInput('params', { name: 'Partner' });
    fixture.detectChanges();

    expect(fixture.componentInstance.normalizedEventType()).toBe('missedCall');
    expect(fixture.componentInstance.i18nKey()).toBe('system.missedCall');
    expect(fixture.nativeElement.textContent).toContain('Partner');
  });

  it('falls back to the generic localized system alert for unknown event types', () => {
    fixture.componentRef.setInput('eventType', 'unknownEventType');
    fixture.detectChanges();

    expect(fixture.componentInstance.i18nKey()).toBe('notifications.systemAlert');
    expect(fixture.nativeElement.textContent).toContain('System alert');
    expect(fixture.nativeElement.textContent).not.toContain('system.unknownEventType');
  });

  it.each(['constructor', 'toString', 'valueOf'])(
    'treats inherited Object key %s as an unknown event rather than a configured event',
    (eventType) => {
      fixture.componentRef.setInput('eventType', eventType);
      fixture.detectChanges();

      expect(fixture.componentInstance.i18nKey()).toBe('notifications.systemAlert');
      expect(fixture.componentInstance.config()).toMatchObject({
        icon: '🔔',
        bgClass: 'bg-surface-200',
      });
      expect(fixture.nativeElement.textContent).toContain('System alert');
      expect(fixture.nativeElement.textContent).not.toContain(`system.${eventType}`);
    },
  );

  it('falls back instead of exposing an unresolved translation placeholder', () => {
    fixture.componentRef.setInput('eventType', 'missedCall');
    fixture.componentRef.setInput('params', { isVideo: true });
    fixture.detectChanges();

    expect(fixture.componentInstance.i18nKey()).toBe('notifications.systemAlert');
    expect(fixture.nativeElement.textContent).not.toContain('{{name}}');
  });

  it('falls back when a required string parameter is blank', () => {
    fixture.componentRef.setInput('eventType', 'profileUpdated');
    fixture.componentRef.setInput('params', { name: '   ' });
    fixture.detectChanges();

    expect(fixture.componentInstance.i18nKey()).toBe('notifications.systemAlert');
    expect(fixture.nativeElement.textContent).toContain('System alert');
    expect(fixture.nativeElement.textContent).not.toContain('{{name}}');
  });

  it.each([-1, 1.5, Number.NaN])(
    'falls back when memberAdded receives an invalid count (%s)',
    (count) => {
      fixture.componentRef.setInput('eventType', 'memberAdded');
      fixture.componentRef.setInput('params', { count });
      fixture.detectChanges();

      expect(fixture.componentInstance.i18nKey()).toBe('notifications.systemAlert');
      expect(fixture.nativeElement.textContent).toContain('System alert');
      expect(fixture.nativeElement.textContent).not.toContain('{{count}}');
    },
  );

  it('keeps only bounded scalar interpolation params and reserves type for the backend', () => {
    fixture.componentRef.setInput('eventType', 'announcement');
    fixture.componentRef.setInput('params', {
      type: 'profileUpdated',
      message: 'x'.repeat(600),
      nested: { unsafe: true },
      count: Number.POSITIVE_INFINITY,
    });

    const params = fixture.componentInstance.displayParams();
    expect(params['type']).toBeUndefined();
    expect(params['nested']).toBeUndefined();
    expect(params['count']).toBeUndefined();
    expect(String(params['message'])).toHaveLength(500);
  });

  it('isolates interpolation params from Object prototype members', () => {
    fixture.componentRef.setInput('eventType', 'announcement');
    fixture.componentRef.setInput('params', {
      message: 'Maintenance starts soon',
      constructor: 'untrusted',
      toString: 'untrusted',
    });

    const params = fixture.componentInstance.displayParams();
    expect(Object.getPrototypeOf(params)).toBeNull();
    expect(params['constructor']).toBe('untrusted');
    expect(params['toString']).toBe('untrusted');
    expect(params['message']).toBe('Maintenance starts soon');
  });

  it('exposes the bubble as an atomic polite status region for assistive technology', () => {
    fixture.componentRef.setInput('eventType', 'memberRemoved');
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
  });

  it('renders custom icons for known event types', () => {
    fixture.componentRef.setInput('eventType', 'profileUpdated');
    fixture.componentRef.setInput('params', { name: 'Partner' });
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(icon).toBeTruthy();
    expect(icon.textContent).toContain('👤');
  });

  it('uses the default icon and styling for unknown event types', () => {
    fixture.componentRef.setInput('eventType', 'unknownEventType');
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    const bubble = fixture.nativeElement.querySelector('span.rounded-full');
    expect(icon.textContent).toContain('🔔');
    expect(bubble.className).toContain('bg-surface-200');
    expect(bubble.className).toContain('border-surface-100');
    expect(bubble.className).toContain('text-text-secondary');
  });

  it('applies event styling without relying on colour alone', () => {
    fixture.componentRef.setInput('eventType', 'missedCall');
    fixture.componentRef.setInput('params', { name: 'Partner' });
    fixture.detectChanges();

    const bubble = fixture.nativeElement.querySelector('span.rounded-full');
    const icon = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(bubble.className).toContain('bg-danger/10');
    expect(bubble.className).toContain('border-danger/30');
    expect(bubble.className).toContain('text-danger');
    expect(icon.textContent).toContain('📞');
  });
});
