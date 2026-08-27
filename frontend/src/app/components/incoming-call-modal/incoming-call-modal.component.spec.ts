import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nService } from '../../services/i18n.service';
import { IncomingCallModalComponent } from './incoming-call-modal.component';

const CALL = {
  callerId: 'caller-1',
  callerName: 'Alice',
  callerAvatarUrl: 'https://cdn.example/avatar.jpg',
  roomName: 'room-1',
  isVideoCall: false,
};

describe('IncomingCallModalComponent', () => {
  let component: IncomingCallModalComponent;
  let fixture: ComponentFixture<IncomingCallModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomingCallModalComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use the generated ringtone when no media URL is configured', () => {
    expect(component.ringtoneUrl()).toBe('');
  });

  it('renders a modal dialog with explicit accept and decline controls', () => {
    fixture.componentRef.setInput('callData', CALL);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement | null;
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'voip.decline',
      'voip.accept',
    ]);
  });

  it('fails closed for malformed required call data', () => {
    fixture.componentRef.setInput('callData', {
      ...CALL,
      roomName: '   ',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not render an unsafe avatar URL', () => {
    fixture.componentRef.setInput('callData', {
      ...CALL,
      callerAvatarUrl: 'javascript:alert(1)',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('A');
  });

  it('emits a normalised accept action only once', () => {
    const emitSpy = vi.fn();
    component.acceptCall.subscribe(emitSpy);
    fixture.componentRef.setInput('callData', {
      ...CALL,
      callerId: ' caller-1 ',
      callerName: ' Alice ',
    });
    fixture.detectChanges();

    component.onAccept();
    component.onAccept();

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(CALL);
    expect(component.actionPending()).toBe(true);
  });

  it('declines with Escape and suppresses a duplicate action', () => {
    const emitSpy = vi.fn();
    component.declineCall.subscribe(emitSpy);
    fixture.componentRef.setInput('callData', CALL);
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true,
    });
    component.handleDocumentKeydown(event);
    component.handleDocumentKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(CALL);
  });

  it('allows actions again when a different call arrives', () => {
    const emitSpy = vi.fn();
    component.declineCall.subscribe(emitSpy);
    fixture.componentRef.setInput('callData', CALL);
    fixture.detectChanges();
    component.onDecline();
    expect(component.actionPending()).toBe(true);

    fixture.componentRef.setInput('callData', {
      ...CALL,
      callerId: 'caller-2',
      roomName: 'room-2',
    });
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(component.actionPending()).toBe(false);
    component.onDecline();
    expect(emitSpy).toHaveBeenCalledTimes(2);
  });

  it('does not emit actions when callData is null', () => {
    const acceptSpy = vi.fn();
    const declineSpy = vi.fn();
    component.acceptCall.subscribe(acceptSpy);
    component.declineCall.subscribe(declineSpy);

    component.onAccept();
    component.onDecline();

    expect(acceptSpy).not.toHaveBeenCalled();
    expect(declineSpy).not.toHaveBeenCalled();
  });

  it('stops cleanly when destroyed', () => {
    expect(() => fixture.destroy()).not.toThrow();
  });
});
