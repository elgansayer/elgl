import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';
import { QuickPollService } from '../../services/quick-poll.service';
import { AudioRoomComponent } from './audio-room.component';

describe('AudioRoomComponent Host Moderation Controls', () => {
  const template = readFileSync(
    resolve(process.cwd(), 'src/app/components/audio-room/audio-room.component.html'),
    'utf8',
  );
  let component: AudioRoomComponent;
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
  let storeMock: {
    currentRoom: ReturnType<typeof signal>;
    stageInfo: ReturnType<typeof signal>;
    stageParticipants: ReturnType<typeof signal>;
    audienceCount: ReturnType<typeof signal>;
    selectedLanguageGroup: ReturnType<typeof signal>;
    roomsByLanguage: ReturnType<typeof signal>;
    activeRooms: ReturnType<typeof signal>;
    loadActiveRooms: ReturnType<typeof vi.fn>;
    loadRoomsByLanguage: ReturnType<typeof vi.fn>;
    loadPrivateRooms: ReturnType<typeof vi.fn>;
    muteSpeaker: ReturnType<typeof vi.fn>;
    kickSpeaker: ReturnType<typeof vi.fn>;
    demoteSpeaker: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock = {
      confirm: vi.fn(),
    };
    storeMock = {
      currentRoom: signal({
        id: 'room-1',
        host_id: 'host-1',
        speakers: ['host-1', 'user-2'],
      } as any),
      stageInfo: signal(null),
      stageParticipants: signal([]),
      audienceCount: signal(0),
      selectedLanguageGroup: signal<string | null>(null),
      roomsByLanguage: signal([]),
      activeRooms: signal([]),
      loadActiveRooms: vi.fn().mockResolvedValue(undefined),
      loadRoomsByLanguage: vi.fn().mockResolvedValue(undefined),
      loadPrivateRooms: vi.fn().mockResolvedValue(undefined),
      muteSpeaker: vi.fn().mockResolvedValue(undefined),
      kickSpeaker: vi.fn().mockResolvedValue(undefined),
      demoteSpeaker: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AudioRoomsStore, useValue: storeMock },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'host-1' }) } },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: QuickPollService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new AudioRoomComponent());
  });

  it('delegates mute to audio rooms store', async () => {
    await component.mute('user-2');
    expect(storeMock.muteSpeaker).toHaveBeenCalledWith('user-2');
  });

  it('does not expose a control that can remotely activate a microphone', () => {
    expect(Object.getOwnPropertyNames(AudioRoomComponent.prototype)).not.toContain('unmute');
  });

  it('delegates demote to audio rooms store', async () => {
    await component.demote('user-2');
    expect(storeMock.demoteSpeaker).toHaveBeenCalledWith('user-2');
  });

  it('prompts confirmation and kicks speaker when confirmed', async () => {
    confirmMock.confirm.mockResolvedValue(true);
    await component.kick('user-2');

    expect(confirmMock.confirm).toHaveBeenCalledWith('audioRoom.kickConfirm');
    expect(storeMock.kickSpeaker).toHaveBeenCalledWith('user-2');
  });

  it('cancels kick when confirmation is dismissed or rejected', async () => {
    confirmMock.confirm.mockResolvedValue(false);
    await component.kick('user-2');

    expect(confirmMock.confirm).toHaveBeenCalledWith('audioRoom.kickConfirm');
    expect(storeMock.kickSpeaker).not.toHaveBeenCalled();
  });

  it('uses accessible semantic colour and touch-target contracts for host controls', () => {
    expect(template).toMatch(/class="[^"]*text-danger-ink[^"]*"\s+\[attr\.aria-label\]="'audioRoom\.kickBtn'/);
    expect(template).toMatch(
      /<button\s+hlmBtn\s+size="touch"\s+\(click\)="selectLanguageGroup\(group\.language_pair\)"/,
    );
  });
});
