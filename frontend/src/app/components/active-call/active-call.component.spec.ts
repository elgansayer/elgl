import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ActiveCallComponent } from './active-call.component';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { LivekitService } from '../../services/livekit.service';

describe('ActiveCallComponent', () => {
  let fixture: ComponentFixture<ActiveCallComponent>;
  let component: ActiveCallComponent;
  let mockLivekitService: ReturnType<typeof createLivekitMock>;
  let mockAuthService: ReturnType<typeof createAuthMock>;

  function createLivekitMock() {
    return {
      joinRoom: vi.fn().mockResolvedValue(undefined),
      publishTracks: vi.fn().mockResolvedValue(undefined),
      toggleMute: vi.fn().mockResolvedValue(true),
      toggleSpeakerphone: vi.fn().mockReturnValue(true),
      leaveRoom: vi.fn(),
    };
  }

  function createAuthMock() {
    return {
      currentUser: signal<{ id: string } | null>({ id: 'user-1' }),
    };
  }

  const mockI18nService = {
    translate: (key: string) => key,
  };

  async function createComponent(
    inputs: {
      callerName?: string;
      callerAvatar?: string;
      roomName?: string;
      callDirection?: 'incoming' | 'outgoing';
      isMuted?: boolean;
      isSpeakerphone?: boolean;
    } = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ActiveCallComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LivekitService, useValue: mockLivekitService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveCallComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('callerName', inputs.callerName ?? 'Jane Doe');
    fixture.componentRef.setInput('roomName', inputs.roomName ?? 'room-123');
    if (inputs.callerAvatar !== undefined) {
      fixture.componentRef.setInput('callerAvatar', inputs.callerAvatar);
    }
    if (inputs.callDirection !== undefined) {
      fixture.componentRef.setInput('callDirection', inputs.callDirection);
    }
    if (inputs.isMuted !== undefined) {
      fixture.componentRef.setInput('isMuted', inputs.isMuted);
    }
    if (inputs.isSpeakerphone !== undefined) {
      fixture.componentRef.setInput('isSpeakerphone', inputs.isSpeakerphone);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    mockLivekitService = createLivekitMock();
    mockAuthService = createAuthMock();
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  it('renders the caller name', async () => {
    await createComponent({ callerName: 'Alex Smith' });

    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toContain('Alex Smith');
  });

  it('renders the caller avatar when provided', async () => {
    await createComponent({ callerAvatar: 'https://example.com/avatar.jpg' });

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('does not render an avatar image when none is provided', async () => {
    await createComponent();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeFalsy();
  });

  describe('connecting to the call on render', () => {
    it('joins the LiveKit room and publishes tracks when a user is signed in', async () => {
      await createComponent({ roomName: 'room-456' });

      expect(mockLivekitService.joinRoom).toHaveBeenCalledWith('room-456', 'user-1', false);
      expect(mockLivekitService.publishTracks).toHaveBeenCalled();
      expect(component.callState()).toBe('connected');
    });

    it('ends the call without joining when no user is signed in', async () => {
      mockAuthService.currentUser.set(null);
      await createComponent();

      expect(mockLivekitService.joinRoom).not.toHaveBeenCalled();
      expect(component.callState()).toBe('ended');
    });

    it('ends the call when joining the LiveKit room fails', async () => {
      mockLivekitService.joinRoom.mockRejectedValue(new Error('connection failed'));
      await createComponent();

      expect(component.callState()).toBe('ended');
    });

    it('ends the call when publishing tracks fails', async () => {
      mockLivekitService.publishTracks.mockRejectedValue(new Error('no microphone'));
      await createComponent();

      expect(component.callState()).toBe('ended');
    });
  });

  describe('mute control', () => {
    it('toggles mute on the LiveKit service and emits muteToggle when clicked', async () => {
      await createComponent();
      const emitSpy = vi.spyOn(component.muteToggle, 'emit');

      const [muteButton] = fixture.nativeElement.querySelectorAll('button');
      muteButton.click();

      expect(mockLivekitService.toggleMute).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalled();
    });

    it('reflects the muted state in the aria-label and styling', async () => {
      await createComponent({ isMuted: true });

      const [muteButton] = fixture.nativeElement.querySelectorAll('button');
      expect(muteButton.getAttribute('aria-label')).toBe('voip.unmute');
      expect(muteButton.classList).toContain('bg-danger');
    });

    it('reflects the unmuted state in the aria-label', async () => {
      await createComponent({ isMuted: false });

      const [muteButton] = fixture.nativeElement.querySelectorAll('button');
      expect(muteButton.getAttribute('aria-label')).toBe('voip.mute');
      expect(muteButton.classList).not.toContain('bg-danger');
    });
  });

  describe('speakerphone control', () => {
    it('toggles the speakerphone on the LiveKit service and emits speakerToggle when clicked', async () => {
      await createComponent();
      const emitSpy = vi.spyOn(component.speakerToggle, 'emit');

      const buttons = fixture.nativeElement.querySelectorAll('button');
      buttons[1].click();

      expect(mockLivekitService.toggleSpeakerphone).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalled();
    });

    it('reflects the active speakerphone state in the aria-label and styling', async () => {
      await createComponent({ isSpeakerphone: true });

      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons[1].getAttribute('aria-label')).toBe('voip.speaker_off');
      expect(buttons[1].classList).toContain('bg-secondary');
    });

    it('reflects the inactive speakerphone state in the aria-label', async () => {
      await createComponent({ isSpeakerphone: false });

      const buttons = fixture.nativeElement.querySelectorAll('button');
      expect(buttons[1].getAttribute('aria-label')).toBe('voip.speaker_on');
      expect(buttons[1].classList).not.toContain('bg-secondary');
    });
  });

  describe('ending the call', () => {
    it('leaves the LiveKit room, sets the call state to ended, and emits endCall when clicked', async () => {
      await createComponent();
      const emitSpy = vi.spyOn(component.endCall, 'emit');
      mockLivekitService.leaveRoom.mockClear();

      const buttons = fixture.nativeElement.querySelectorAll('button');
      buttons[2].click();

      expect(mockLivekitService.leaveRoom).toHaveBeenCalled();
      expect(component.callState()).toBe('ended');
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('leaves the LiveKit room when the component is destroyed', async () => {
      await createComponent();
      mockLivekitService.leaveRoom.mockClear();

      fixture.destroy();

      expect(mockLivekitService.leaveRoom).toHaveBeenCalled();
    });
  });
});
