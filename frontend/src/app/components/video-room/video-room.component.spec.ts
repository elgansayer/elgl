import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, NO_ERRORS_SCHEMA } from '@angular/core';
import { vi, Mocked } from 'vitest';
import { VideoRoomComponent } from './video-room.component';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';

describe('VideoRoomComponent', () => {
  let component: VideoRoomComponent;
  let fixture: ComponentFixture<VideoRoomComponent>;
  let mockStore: Mocked<Partial<AudioRoomsStore>>;
  let mockAuthService: Mocked<Partial<AuthService>>;
  let currentRoomSignal: ReturnType<typeof signal<AudioRoomRecord | null>>;

  const baseRoom: AudioRoomRecord = {
    id: 'room-1',
    room_name: 'room-1',
    title: 'Test Room',
    target_language: 'es',
    host_id: 'host-1',
    co_host_id: null,
    is_video_stream: true,
    is_active: true,
    speakers: ['host-1', 'speaker-2'],
    raised_hands: [],
    listeners_count: 3,
    created_at: new Date().toISOString(),
  };

  async function setup(room: AudioRoomRecord | null, currentUserId: string): Promise<void> {
    currentRoomSignal = signal(room);

    mockStore = {
      currentRoom: currentRoomSignal,
      hostVideoTrack: signal(null),
      coHostVideoTrack: signal(null),
      localVideoTrack: signal(null),
      inviteCoHost: vi.fn().mockResolvedValue(undefined),
      removeCoHost: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<Partial<AudioRoomsStore>>;

    mockAuthService = {
      currentUser: signal({ id: currentUserId } as never),
    } as unknown as Mocked<Partial<AuthService>>;

    await TestBed.configureTestingModule({
      imports: [VideoRoomComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoRoomComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should render connecting skeleton loader when there is no current room', async () => {
    await setup(null, 'host-1');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.trim()).toContain('Connecting to room...');
  });

  it('should show the invite co-host button for the host when eligible speakers exist', async () => {
    await setup(baseRoom, 'host-1');
    expect(component.isHost()).toBe(true);
    expect(component.eligibleSpeakers()).toEqual(['speaker-2']);

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const inviteBtn = Array.from(buttons).find(
      (b) => b.textContent?.includes('Invite co-host'),
    );
    expect(inviteBtn).toBeTruthy();
  });

  it('should not show the invite co-host button to a non-host', async () => {
    await setup(baseRoom, 'speaker-2');
    expect(component.isHost()).toBe(false);

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    // Only the onboarding help "?" button should be visible
    const inviteCoHostBtn = Array.from(buttons).find(
      (b) => b.textContent?.includes('Invite co-host'),
    );
    expect(inviteCoHostBtn).toBeUndefined();
  });

  it('should invite the selected speaker as co-host and hide the picker', async () => {
    await setup(baseRoom, 'host-1');
    component.showInvitePicker.set(true);

    component.selectCoHost('speaker-2');

    expect(mockStore.inviteCoHost).toHaveBeenCalledWith('speaker-2');
    expect(component.showInvitePicker()).toBe(false);
  });

  it('should render the split-screen co-host tile once a co-host is present', async () => {
    await setup({ ...baseRoom, co_host_id: 'speaker-2' }, 'host-1');

    expect(component.hasCoHost()).toBe(true);
    expect(component.gridClass()).toContain('md:grid-cols-2');
  });

  it('should call removeCoHost when the host removes the co-host', async () => {
    await setup({ ...baseRoom, co_host_id: 'speaker-2' }, 'host-1');

    component.removeCoHost();

    expect(mockStore.removeCoHost).toHaveBeenCalled();
  });

  it('should render live chat overlay inside host video tile', async () => {
    await setup(baseRoom, 'host-1');
    const el = fixture.nativeElement as HTMLElement;
    const overlay = el.querySelector('app-live-chat-overlay');
    expect(overlay).toBeTruthy();
  });
});
