import { ComponentFixture, TestBed } from '@angular/core/testing';
<<<<<<< HEAD
<<<<<<< HEAD
import {
  IncomingCallModalComponent,
  IncomingCallData,
} from './incoming-call-modal.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { signal } from '@angular/core';
=======
import { IncomingCallModalComponent, IncomingCallData } from './incoming-call-modal.component';
import { I18nService } from '../../../services/i18n.service';
>>>>>>> origin/main
=======

import { IncomingCallModalComponent, IncomingCallData } from './incoming-call-modal.component';
import { I18nService } from '../../services/i18n.service';
>>>>>>> origin/main
import { vi } from 'vitest';

describe('IncomingCallModalComponent', () => {
  let component: IncomingCallModalComponent;
<<<<<<< HEAD

  const mockCallData: IncomingCallData = {
    callerId: 'caller-123',
    callerName: 'Test Caller',
    callerAvatarUrl: 'https://example.com/avatar.jpg',
    roomName: 'test-room',
    isVideoCall: true,
  };

  const i18nStub = {
    currentLang: signal('en-GB'),
    direction: signal('ltr'),
    translate: vi.fn((key: string) => key),
    availableLanguages: [],
  };
=======
  let fixture: ComponentFixture<IncomingCallModalComponent>;
>>>>>>> origin/main

  const mockCallData: IncomingCallData = {
    callerId: 'caller-1',
    callerName: 'Test User',
    roomName: 'room-1',
    isVideoCall: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomingCallModalComponent],
<<<<<<< HEAD
      providers: [
        { provide: I18nService, useValue: i18nStub },
        TranslatePipe,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncomingCallModalComponent);
=======
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallModalComponent);
>>>>>>> origin/main
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

<<<<<<< HEAD
<<<<<<< HEAD
  it('should emit acceptCall when onAccept is called', () => {
    const emitSpy = vi.spyOn(component.acceptCall, 'emit');
    component.callData = signal(mockCallData) as unknown as typeof component.callData;

    component.onAccept();

    expect(emitSpy).toHaveBeenCalledWith(mockCallData);
  });

  it('should emit declineCall when onDecline is called', () => {
    const emitSpy = vi.spyOn(component.declineCall, 'emit');
    component.callData = signal(mockCallData) as unknown as typeof component.callData;

    component.onDecline();

    expect(emitSpy).toHaveBeenCalledWith(mockCallData);
  });

  it('should not emit acceptCall when callData is null', () => {
    const emitSpy = vi.spyOn(component.acceptCall, 'emit');

    component.onAccept();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should not emit declineCall when callData is null', () => {
    const emitSpy = vi.spyOn(component.declineCall, 'emit');

    component.onDecline();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should clean up on destroy', () => {
    expect(() => component.ngOnDestroy()).not.toThrow();
=======
  it('should not show modal when callData is null', () => {
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.fixed');
    expect(modal).toBeNull();
=======
  it('should have default ringtoneUrl value', () => {
    expect(component.ringtoneUrl()).toBe('/assets/audio/ringtone.wav');
>>>>>>> origin/main
  });

  it('should have null callData initially', () => {
    expect(component.callData()).toBeNull();
  });

  it('should not emit acceptCall when callData is null', () => {
    const emitSpy = vi.fn();
    component.acceptCall.subscribe(emitSpy);

    component.onAccept();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should not emit declineCall when callData is null', () => {
    const emitSpy = vi.fn();
    component.declineCall.subscribe(emitSpy);

    component.onDecline();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should not have ringtone audio element when callData is null', () => {
    const audioEl = fixture.nativeElement.querySelector('audio');
    expect(audioEl).toBeNull();
  });

<<<<<<< HEAD
  it('should have accept and decline buttons with proper aria labels', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    const declineBtn = Array.from(buttons).find(
      (b: unknown) => (b as HTMLElement).getAttribute('aria-label') === 'voip.decline'
    );
    const acceptBtn = Array.from(buttons).find(
      (b: unknown) => (b as HTMLElement).getAttribute('aria-label') === 'voip.accept'
    );
    expect(declineBtn).toBeTruthy();
    expect(acceptBtn).toBeTruthy();
>>>>>>> origin/main
=======
  it('should handle ngOnDestroy gracefully', () => {
    // Component uses DestroyRef, make sure destroy doesn't throw
    expect(() => fixture.destroy()).not.toThrow();
>>>>>>> origin/main
  });
});