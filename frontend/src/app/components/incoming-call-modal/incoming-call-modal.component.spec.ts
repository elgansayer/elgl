import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  IncomingCallModalComponent,
  IncomingCallData,
} from './incoming-call-modal.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('IncomingCallModalComponent', () => {
  let component: IncomingCallModalComponent;

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomingCallModalComponent],
      providers: [
        { provide: I18nService, useValue: i18nStub },
        TranslatePipe,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncomingCallModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

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
  });
});