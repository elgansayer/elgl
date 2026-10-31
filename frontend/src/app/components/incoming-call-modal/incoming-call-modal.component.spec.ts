import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IncomingCallModalComponent } from './incoming-call-modal.component';
import { I18nService } from '../../services/i18n.service';
import { vi } from 'vitest';

describe('IncomingCallModalComponent', () => {
  let component: IncomingCallModalComponent;
  let fixture: ComponentFixture<IncomingCallModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomingCallModalComponent],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default ringtoneUrl value', () => {
    expect(component.ringtoneUrl()).toBe('/assets/audio/ringtone.wav');
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

  it('does not claim that an incoming call is encrypted before it connects', () => {
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    fixture.componentRef.setInput('callData', {
      callerId: 'user-456',
      callerName: 'Alice',
      roomName: 'room-1',
      isVideoCall: false,
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Encrypted call');
    fixture.componentRef.setInput('callData', null);
    fixture.detectChanges();
    playSpy.mockRestore();
    pauseSpy.mockRestore();
  });

  it('should handle ngOnDestroy gracefully', () => {
    // Component uses DestroyRef, make sure destroy doesn't throw
    expect(() => fixture.destroy()).not.toThrow();
  });
});
