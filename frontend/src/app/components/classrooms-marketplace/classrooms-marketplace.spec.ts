import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, NO_ERRORS_SCHEMA, importProvidersFrom } from '@angular/core';
import { JoyrideModule } from 'ngx-joyride';
import { vi } from 'vitest';

import { ClassroomsMarketplace } from './classrooms-marketplace';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { TourService } from '../../services/tour.service';

describe('ClassroomsMarketplace', () => {
  let component: ClassroomsMarketplace;
  let fixture: ComponentFixture<ClassroomsMarketplace>;
  let mockStore: { activeRooms: ReturnType<typeof signal<AudioRoomRecord[]>>; joinRoom: ReturnType<typeof vi.fn> };
  let mockTourService: { startVideoClassroomTour: ReturnType<typeof vi.fn>; resetVideoClassroomTour: ReturnType<typeof vi.fn> };

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
        importProvidersFrom(JoyrideModule.forRoot()),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AudioRoomsStore, useValue: mockStore },
        { provide: TourService, useValue: mockTourService },
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
  });
});
