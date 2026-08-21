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

  it('should handle ngOnDestroy gracefully', () => {
    // Component uses DestroyRef, make sure destroy doesn't throw
    expect(() => fixture.destroy()).not.toThrow();
  });
});
