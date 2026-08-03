import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioRoomComponent, AudioRoomParticipant } from './audio-room.component';
import { I18nService } from '../services/i18n.service';

describe('AudioRoomComponent', () => {
  let component: AudioRoomComponent;
  let fixture: ComponentFixture<AudioRoomComponent>;

  const hostParticipant: AudioRoomParticipant = {
    id: 'host-1',
    displayName: 'Host Name',
    avatarUrl: null,
    isSpeaking: true,
    isMuted: false,
    isHost: true,
  };

  const speakerA: AudioRoomParticipant = {
    id: 'speaker-a',
    displayName: 'Speaker Alpha',
    avatarUrl: null,
    isSpeaking: false,
    isMuted: true,
    isHost: false,
  };

  const listenerA: AudioRoomParticipant = {
    id: 'listener-a',
    displayName: 'Listener Alpha',
    avatarUrl: null,
    isSpeaking: false,
    isMuted: false,
    isHost: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioRoomComponent],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioRoomComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('host', hostParticipant);
    fixture.componentRef.setInput('speakers', [speakerA]);
    fixture.componentRef.setInput('listeners', [listenerA]);
    fixture.componentRef.setInput('isVideoStream', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute counts', () => {
    expect(component.speakerCount()).toBe(1);
    expect(component.listenerCount()).toBe(1);
    expect(component.stageParticipants().length).toBe(2);
  });

  it('should render host name and translated headers', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Host Name');
    expect(el.textContent).toContain('Speaker Stage Grid');
    expect(el.textContent).toContain('Listener Audience Grid');
  });

  it('should show video icon when video stream is enabled', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('🎥');
  });
});
