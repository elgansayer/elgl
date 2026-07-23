import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoipCallComponent } from './voip-call.component';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';
import { signal } from '@angular/core';

describe('VoipCallComponent', () => {
  let component: VoipCallComponent;
  let fixture: ComponentFixture<VoipCallComponent>;
  let i18nServiceMock: Partial<I18nService>;
  let centrifugoServiceMock: Partial<CentrifugoService>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      translate: (key: string) => key,
    };

    centrifugoServiceMock = {
      events: signal([]),
      publish: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VoipCallComponent],
      providers: [
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: CentrifugoService, useValue: centrifugoServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoipCallComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('callerName', 'Test User');
    fixture.componentRef.setInput('callerId', 'user-123');
    fixture.componentRef.setInput('roomId', 'room-456');
    fixture.componentRef.setInput('callState', 'connecting');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle mute state', () => {
    const muteSpy = jest.fn();
    component.muteToggled.subscribe(muteSpy);
    
    expect(component.muted()).toBe(false);
    component.toggleMute();
    expect(component.muted()).toBe(true);
    expect(muteSpy).toHaveBeenCalledWith(true);
    expect(centrifugoServiceMock.publish).toHaveBeenCalledWith('room_room-456', {
      type: 'remote_mute',
      userId: 'user-123',
    });
  });

  it('should toggle speaker state', () => {
    const speakerSpy = jest.fn();
    component.speakerToggled.subscribe(speakerSpy);
    
    expect(component.speakerOn()).toBe(false);
    component.toggleSpeaker();
    expect(component.speakerOn()).toBe(true);
    expect(speakerSpy).toHaveBeenCalledWith(true);
  });

  it('should emit callEnded on endCall', () => {
    const endSpy = jest.fn();
    component.callEnded.subscribe(endSpy);
    
    component.endCall();
    expect(endSpy).toHaveBeenCalled();
  });

  it('should emit dismiss on dismiss', () => {
    const dismissSpy = jest.fn();
    component.dismiss.subscribe(dismissSpy);
    
    component.dismiss.emit();
    expect(dismissSpy).toHaveBeenCalled();
  });

  it('should start duration timer when call state becomes connected', () => {
    jest.useFakeTimers();
    fixture.componentRef.setInput('callState', 'connected');
    fixture.detectChanges();
    
    expect(component.callDuration()).toBe('00:00');
    
    jest.advanceTimersByTime(5000);
    expect(component.callDuration()).toBe('00:05');
    
    jest.useRealTimers();
  });

  it('should stop duration timer when call ends', () => {
    jest.useFakeTimers();
    fixture.componentRef.setInput('callState', 'connected');
    fixture.detectChanges();
    
    jest.advanceTimersByTime(3000);
    
    fixture.componentRef.setInput('callState', 'ended');
    fixture.detectChanges();
    
    const durationBeforeEnd = component.callDuration();
    jest.advanceTimersByTime(5000);
    expect(component.callDuration()).toBe(durationBeforeEnd);
    
    jest.useRealTimers();
  });
});
