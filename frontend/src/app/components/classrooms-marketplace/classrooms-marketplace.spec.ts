import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, NO_ERRORS_SCHEMA, ErrorHandler } from '@angular/core';

import { ClassroomsMarketplace } from './classrooms-marketplace';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { AuthService } from '../../services/auth.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { VideoClassroomErrorHandlerService } from '../../services/video-classroom-error-handler.service';
import { VideoClassroomOnboardingService } from '../../services/video-classroom-onboarding.service';

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
