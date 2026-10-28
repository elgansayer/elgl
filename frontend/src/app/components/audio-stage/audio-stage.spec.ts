import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { AudioStage } from './audio-stage';
import { StageParticipant } from '../../services/audio-rooms.store';
import { I18nService } from '../../services/i18n.service';

describe('AudioStage', () => {
  let component: AudioStage;
  let componentRef: ComponentRef<AudioStage>;
  let fixture: ComponentFixture<AudioStage>;

  const mockParticipants: StageParticipant[] = [
    {
      user_id: 'user-host',
      display_name: 'Hana',
      avatar_url: null,
      isSpeaking: true,
      isMuted: false,
      isHost: true,
      isCoHost: false,
    },
    {
      user_id: 'user-cohost',
      display_name: 'Kenji',
      avatar_url: 'https://example.com/avatar.jpg',
      isSpeaking: false,
      isMuted: false,
      isHost: false,
      isCoHost: true,
    },
    {
      user_id: 'user-speaker',
      display_name: 'Ana',
      avatar_url: null,
      isSpeaking: false,
      isMuted: true,
      isHost: false,
      isCoHost: false,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioStage],
      providers: [
        {
          provide: I18nService,
          useValue: {
            currentLang: () => 'en-GB',
            translate: (key: string, params?: Record<string, unknown>) => {
              if (params && 'count' in params) {
                return `${key}:${params['count']}`;
              }
              return key;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioStage);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calculates open seats correctly', async () => {
    componentRef.setInput('maxSeats', 4);
    componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.openSeatsCount()).toBe(1);
    expect(component.openSeatsArray()).toEqual([0]);
  });

  it('renders participant speakers with roles and indicators', async () => {
    componentRef.setInput('maxSeats', 4);
    componentRef.setInput('participants', mockParticipants);
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const speakerItems = element.querySelectorAll('[role="listitem"]');
    expect(speakerItems.length).toBe(3);

    // Host should be labelled
    expect(element.textContent).toContain('Hana');
    expect(element.textContent).toContain('audioStage.host');

    // Co-host should be labelled
    expect(element.textContent).toContain('Kenji');
    expect(element.textContent).toContain('audioStage.coHost');

    // Muted indicator
    expect(element.textContent).toContain('Ana');
    expect(element.textContent).toContain('🔇');
  });

  it('emits raiseHand when open seat is clicked and hand is not raised', async () => {
    componentRef.setInput('maxSeats', 4);
    componentRef.setInput('participants', mockParticipants);
    componentRef.setInput('isHandRaised', false);
    componentRef.setInput('canRaiseHand', true);
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = false;
    component.raiseHand.subscribe(() => {
      emitted = true;
    });

    const element = fixture.nativeElement as HTMLElement;
    const openSeatBtn = element.querySelector('button[disabled="false"], button:not([disabled])') as HTMLButtonElement | null;
    expect(openSeatBtn).toBeTruthy();
    openSeatBtn?.click();

    expect(emitted).toBe(true);
  });

  it('emits lowerHand when hand is raised and button is clicked', async () => {
    componentRef.setInput('maxSeats', 4);
    componentRef.setInput('participants', mockParticipants);
    componentRef.setInput('isHandRaised', true);
    componentRef.setInput('canRaiseHand', true);
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = false;
    component.lowerHand.subscribe(() => {
      emitted = true;
    });

    component.onOpenSeatClick();
    expect(emitted).toBe(true);
  });

  it('renders host moderation buttons when isHost is true', async () => {
    componentRef.setInput('maxSeats', 4);
    componentRef.setInput('participants', mockParticipants);
    componentRef.setInput('currentUserId', 'user-host');
    componentRef.setInput('isHost', true);
    fixture.detectChanges();
    await fixture.whenStable();

    let mutedUserId: string | null = null;
    component.muteParticipant.subscribe((id) => {
      mutedUserId = id;
    });

    let demotedUserId: string | null = null;
    component.demoteParticipant.subscribe((id) => {
      demotedUserId = id;
    });

    component.onMuteParticipant('user-speaker');
    expect(mutedUserId).toBe('user-speaker');

    component.onDemoteParticipant('user-cohost');
    expect(demotedUserId).toBe('user-cohost');
  });

  it('shows toolbar controls for participant on stage', async () => {
    componentRef.setInput('maxSeats', 4);
    componentRef.setInput('participants', mockParticipants);
    componentRef.setInput('currentUserId', 'user-speaker');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isCurrentUserOnStage()).toBe(true);

    let muteToggled = false;
    component.toggleMute.subscribe(() => {
      muteToggled = true;
    });

    component.onToggleMute();
    expect(muteToggled).toBe(true);
  });
});
