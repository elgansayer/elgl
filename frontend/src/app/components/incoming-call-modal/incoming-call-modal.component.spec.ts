import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  });

  it('should show modal when callData is set', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.fixed');
    expect(modal).toBeTruthy();
  });

  it('should emit acceptCall when accept button is clicked', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    const emitSpy = vi.fn();
    component.acceptCall.subscribe(emitSpy);

    fixture.detectChanges();
    component.onAccept();
    expect(emitSpy).toHaveBeenCalledWith(callData);
  });

  it('should emit declineCall when decline button is clicked', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    const emitSpy = vi.fn();
    component.declineCall.subscribe(emitSpy);

    fixture.detectChanges();
    component.onDecline();
    expect(emitSpy).toHaveBeenCalledWith(callData);
  });

  it('should display video call text when isVideoCall is true', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: true,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('voip.incomingVideoCall');
  });

  it('should display voice call text when isVideoCall is false', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('voip.incomingVoiceCall');
  });

  it('should display caller avatar when provided', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      callerAvatarUrl: 'https://example.com/avatar.jpg',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.src).toContain('avatar.jpg');
  });

  it('should display initial letter avatar when no avatar URL', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Alice',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();

    const letterSpan = fixture.nativeElement.querySelector(
      '.rounded-full.bg-gradient-to-br span'
    );
    expect(letterSpan).toBeTruthy();
    expect(letterSpan.textContent.trim()).toBe('A');
  });

  it('should have ringtone audio element when call is active', () => {
    const callData: IncomingCallData = {
      callerId: 'caller-1',
      callerName: 'Test User',
      roomName: 'room-1',
      isVideoCall: false,
    };
    fixture.componentRef.setInput('callData', callData);
    fixture.detectChanges();

    const audioEl = fixture.nativeElement.querySelector('audio');
    expect(audioEl).toBeTruthy();
    expect(audioEl.src).toContain('ringtone.mp3');
  });

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
  });
});