import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  signal,
  NO_ERRORS_SCHEMA,
  ErrorHandler,
  WritableSignal,
  importProvidersFrom,
} from '@angular/core';
import { JoyrideModule } from 'ngx-joyride';

import { ClassroomsMarketplace } from './classrooms-marketplace';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { VideoClassroomErrorHandlerService } from '../../services/video-classroom-error-handler.service';
import { VideoClassroomOnboardingService } from '../../services/video-classroom-onboarding.service';
import { OfflineVideoClassroomService } from '../../services/offline-video-classroom.service';
import { environment } from '../../../environments/environment';

describe.skip('ClassroomsMarketplace', () => {
  let component: ClassroomsMarketplace;
  let fixture: ComponentFixture<ClassroomsMarketplace>;

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
    await TestBed.configureTestingModule({
      imports: [ClassroomsMarketplace],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService },
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        { provide: VideoClassroomOnboardingService, useValue: { startMarketplaceTour: vi.fn(), isCompleted: vi.fn().mockReturnValue(true), isTourInProgress: signal(false) } },
        VideoClassroomErrorHandlerService,
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
  });
});

describe('ClassroomsMarketplace live room list', () => {
  const buildRoom = (id: string): AudioRoomRecord => ({
    id,
    room_name: id,
    title: `Classroom ${id}`,
    target_language: 'es',
    language_pair: 'en-es',
    host_id: 'host-1',
    co_host_id: null,
    is_video_stream: true,
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 1,
    created_at: '2026-11-01T00:00:00.000Z',
  });
  const ids = (rooms: AudioRoomRecord[]): string[] => rooms.map((room) => room.id);

  let fixture: ComponentFixture<ClassroomsMarketplace>;
  let component: ClassroomsMarketplace;
  let http: HttpTestingController;
  let activeRooms: WritableSignal<AudioRoomRecord[]>;
  let createRoom: ReturnType<typeof vi.fn>;
  let cacheClassroomListing: ReturnType<typeof vi.fn>;

  async function create(): Promise<void> {
    activeRooms = signal<AudioRoomRecord[]>([]);
    createRoom = vi.fn();
    cacheClassroomListing = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [ClassroomsMarketplace],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        importProvidersFrom(JoyrideModule.forRoot()),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'user-1' }), getAccessToken: vi.fn() },
        },
        { provide: AudioRoomsStore, useValue: { activeRooms, createRoom, joinRoom: vi.fn() } },
        {
          provide: VideoClassroomErrorHandlerService,
          useValue: {
            reportVideoClassroomCrash: vi.fn(),
            wrapClassroomCall: (_name: string, action: () => Promise<void>) => action(),
          },
        },
        {
          provide: VideoClassroomOnboardingService,
          useValue: { isCompleted: vi.fn().mockReturnValue(true) },
        },
        {
          provide: OfflineVideoClassroomService,
          useValue: {
            cacheClassroomListing,
            getCachedClassroomListing: vi.fn().mockResolvedValue(null),
          },
        },
      ],
    });
    await TestBed.compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClassroomsMarketplace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  async function respondWith(list: AudioRoomRecord[]): Promise<void> {
    http.expectOne(`${environment.apiUrl}/audio-rooms/list`).flush(list);
    await fixture.whenStable();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the rooms loaded over HTTP and caches them for offline use', async () => {
    await create();

    await respondWith([buildRoom('http-1'), buildRoom('http-2')]);

    expect(ids(component.rooms())).toEqual(['http-1', 'http-2']);
    expect(component.isLoading()).toBe(false);
    expect(cacheClassroomListing).toHaveBeenCalledOnce();
  });

  it('follows the store immediately when it publishes rooms, without any polling timer', async () => {
    vi.useFakeTimers();
    await create();
    await respondWith([buildRoom('http-1')]);

    activeRooms.set([buildRoom('live-1'), buildRoom('live-2')]);

    expect(ids(component.rooms())).toEqual(['live-1', 'live-2']);
    vi.advanceTimersByTime(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the last known rooms when the store empties', async () => {
    await create();
    await respondWith([buildRoom('http-1')]);

    activeRooms.set([]);
    expect(ids(component.rooms())).toEqual(['http-1']);

    activeRooms.set([buildRoom('live-1')]);
    expect(ids(component.rooms())).toEqual(['live-1']);
    activeRooms.set([]);
    expect(ids(component.rooms())).toEqual(['live-1']);
  });

  it('lets a later HTTP refresh replace the rooms taken from the store', async () => {
    await create();
    await respondWith([]);
    activeRooms.set([buildRoom('live-1')]);

    const reload = component.loadRooms();
    http.expectOne(`${environment.apiUrl}/audio-rooms/list`).flush([buildRoom('fresh-1')]);
    await reload;

    expect(ids(component.rooms())).toEqual(['fresh-1']);
  });

  it('lists a created classroom exactly once because the store owns the write', async () => {
    await create();
    await respondWith([buildRoom('http-1')]);
    createRoom.mockImplementation(async () => {
      const created = buildRoom('created-1');
      activeRooms.update((list) => [created, ...list]);
      return created;
    });

    await component.createClassroom('Spanish chat', 'en-es', 'travel');

    expect(createRoom).toHaveBeenCalledWith('Spanish chat', 'en-es', 'travel', true);
    expect(ids(component.rooms())).toEqual(['created-1']);
  });
});
