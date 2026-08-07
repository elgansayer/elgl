import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
<<<<<<< HEAD
import { signal, NO_ERRORS_SCHEMA, importProvidersFrom } from '@angular/core';
import { JoyrideModule } from 'ngx-joyride';
import { vi } from 'vitest';

import { ClassroomsMarketplace } from './classrooms-marketplace';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { TourService } from '../../services/tour.service';
=======
import { signal, NO_ERRORS_SCHEMA, ErrorHandler } from '@angular/core';

import { ClassroomsMarketplace } from './classrooms-marketplace';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { VideoClassroomErrorHandlerService } from '../../services/video-classroom-error-handler.service';
>>>>>>> origin/main

describe('ClassroomsMarketplace', () => {
  let component: ClassroomsMarketplace;
  let fixture: ComponentFixture<ClassroomsMarketplace>;
  let mockStore: { activeRooms: ReturnType<typeof signal<AudioRoomRecord[]>>; joinRoom: ReturnType<typeof vi.fn> };
  let mockTourService: { startVideoClassroomTour: ReturnType<typeof vi.fn>; resetVideoClassroomTour: ReturnType<typeof vi.fn> };

  const baseRoom: AudioRoomRecord = {
    id: 'room-1',
    room_name: 'room-1',
    title: 'Test Video Classroom',
    target_language: 'es',
    language_pair: 'en-es',
    host_id: 'host-1',
    co_host_id: null,
    is_video_stream: true,
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 5,
    created_at: new Date().toISOString(),
  };

  const mockAuthService = {
    currentUser: signal({ id: 'user-1' }),
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
  };

  const mockStore = {
    activeRooms: signal([]),
    roomsByLanguage: signal([]),
    joinRoom: vi.fn().mockResolvedValue(undefined),
    createRoom: vi.fn().mockResolvedValue(baseRoom),
  };

  beforeEach(async () => {
    mockStore = {
      activeRooms: signal<AudioRoomRecord[]>([]),
      joinRoom: vi.fn().mockResolvedValue(undefined),
    };

    mockTourService = {
      startVideoClassroomTour: vi.fn(),
      resetVideoClassroomTour: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ClassroomsMarketplace],
      providers: [
<<<<<<< HEAD
        importProvidersFrom(JoyrideModule.forRoot()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: TourService, useValue: mockTourService },
=======
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        VideoClassroomErrorHandlerService,
>>>>>>> origin/main
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassroomsMarketplace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

<<<<<<< HEAD
  it('should start the onboarding tour when startOnboardingTour is called', () => {
    component.startOnboardingTour();
    expect(mockTourService.resetVideoClassroomTour).toHaveBeenCalled();
    expect(mockTourService.startVideoClassroomTour).toHaveBeenCalled();
  });

  it('should show empty state when there are no active rooms', () => {
    mockStore.activeRooms.set([]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('No active rooms right now');
  });

  it('should display video stream rooms in a grid', () => {
    mockStore.activeRooms.set([
      {
        id: 'room-1',
        room_name: 'room-1',
        title: 'Spanish Practice',
        target_language: 'es',
        host_id: 'host-1',
        is_video_stream: true,
        is_active: true,
        speakers: ['host-1'],
        raised_hands: [],
        listeners_count: 3,
        created_at: new Date().toISOString(),
        host: { id: 'host-1', display_name: 'Maria' },
      },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Spanish Practice');
    expect(el.textContent).toContain('Join room');
  });

  it('should call joinRoom on the store when joining a room', () => {
    const room: AudioRoomRecord = {
      id: 'room-1',
      room_name: 'room-1',
      title: 'Test Room',
      target_language: 'fr',
      host_id: 'host-1',
      is_video_stream: true,
      is_active: true,
      speakers: ['host-1'],
      raised_hands: [],
      listeners_count: 1,
      created_at: new Date().toISOString(),
    };

    component.joinRoom(room);
    expect(mockStore.joinRoom).toHaveBeenCalledWith(room);
=======
  it('should show loading state initially', () => {
    expect(component.isLoading()).toBe(true);
  });

  it('should display empty state when no video rooms are available', () => {
    component.isLoading.set(false);
    component.errorMessage.set('');
    component.rooms.set([]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('classroomsMarketplace.emptyTitle');
  });

  it('should show error state with retry button when error occurs', () => {
    component.isLoading.set(false);
    component.errorMessage.set('Network error');
    component.rooms.set([]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('classroomsMarketplace.loadErrorTitle');
    const retryBtn = el.querySelector('button');
    expect(retryBtn).toBeTruthy();
  });

  it('should filter rooms by language', () => {
    const rooms: AudioRoomRecord[] = [
      { ...baseRoom, id: 'room-1', language_pair: 'en-es', is_video_stream: true },
      { ...baseRoom, id: 'room-2', language_pair: 'en-fr', is_video_stream: true },
    ];
    component.rooms.set(rooms);
    component.isLoading.set(false);
    fixture.detectChanges();

    expect(component.videoRooms().length).toBe(2);

    component.selectLanguage('en-es');
    expect(component.selectedLanguage()).toBe('en-es');
    expect(component.videoRooms().length).toBe(1);
    expect(component.videoRooms()[0].id).toBe('room-1');
  });

  it('should filter to video rooms only', () => {
    const rooms: AudioRoomRecord[] = [
      { ...baseRoom, id: 'room-1', is_video_stream: true },
      { ...baseRoom, id: 'room-2', is_video_stream: false },
    ];
    component.rooms.set(rooms);
    component.isLoading.set(false);
    fixture.detectChanges();

    expect(component.videoRooms().length).toBe(1);
    expect(component.videoRooms()[0].id).toBe('room-1');
  });

  it('should clear language filter when selecting All', () => {
    component.selectLanguage('en-es');
    expect(component.selectedLanguage()).toBe('en-es');

    component.selectLanguage(null);
    expect(component.selectedLanguage()).toBeNull();
>>>>>>> origin/main
  });
});
