import { TestBed } from '@angular/core/testing';
import { JoyrideService } from 'ngx-joyride';
import { of } from 'rxjs';
import { VideoClassroomOnboardingService } from './video-classroom-onboarding.service';

describe('VideoClassroomOnboardingService', () => {
  let service: VideoClassroomOnboardingService;

  const mockJoyrideService = {
    startTour: vi.fn().mockReturnValue(of(undefined)),
    closeTour: vi.fn(),
    isTourInProgress: vi.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_video_classroom_onboarding_done');
    TestBed.configureTestingModule({
      providers: [
        { provide: JoyrideService, useValue: mockJoyrideService },
      ],
    });
    service = TestBed.inject(VideoClassroomOnboardingService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.removeItem('hellotalk_video_classroom_onboarding_done');
  });

  it('should return false for isCompleted when not set', () => {
    expect(service.isCompleted()).toBe(false);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should return true for isCompleted after markComplete', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should have correct step names', () => {
    expect(service.stepNames.length).toBe(6);
    expect(service.stepNames).toContain('videoClassroomStepMarketplace');
    expect(service.stepNames).toContain('videoClassroomStepFilters');
    expect(service.stepNames).toContain('videoClassroomStepRoomCard');
    expect(service.stepNames).toContain('videoClassroomStepHostVideo');
    expect(service.stepNames).toContain('videoClassroomStepCoHost');
    expect(service.stepNames).toContain('videoClassroomStepInviteCoHost');
  });

  it('should have marketplace and room step subsets', () => {
    expect(service.marketplaceStepNames).toEqual([
      'videoClassroomStepMarketplace',
      'videoClassroomStepFilters',
      'videoClassroomStepRoomCard',
    ]);
    expect(service.roomStepNames).toEqual([
      'videoClassroomStepHostVideo',
      'videoClassroomStepCoHost',
      'videoClassroomStepInviteCoHost',
    ]);
  });

  it('should track isTourInProgress signal', () => {
    expect(service.isTourInProgress()).toBe(false);
    service.isTourInProgress.set(true);
    expect(service.isTourInProgress()).toBe(true);
    service.isTourInProgress.set(false);
    expect(service.isTourInProgress()).toBe(false);
  });

  it('should persist completion to localStorage', () => {
    service.markComplete();
    expect(window.localStorage.getItem('hellotalk_video_classroom_onboarding_done')).toBe('true');
  });

  it('should reset the onboarding state', () => {
    service.markComplete();
    expect(service.isCompleted()).toBe(true);
    service.reset();
    expect(service.isCompleted()).toBe(false);
    expect(service.isTourInProgress()).toBe(false);
    expect(window.localStorage.getItem('hellotalk_video_classroom_onboarding_done')).toBeNull();
  });

  it('should call joyrideService.startTour when startMarketplaceTour is called', () => {
    mockJoyrideService.isTourInProgress.mockReturnValue(false);
    service.startMarketplaceTour();
    expect(mockJoyrideService.startTour).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: service.marketplaceStepNames,
        themeColor: '#a855f7',
        showCounter: true,
        showPrevButton: true,
      }),
    );
  });

  it('should call joyrideService.startTour when startRoomTour is called', () => {
    mockJoyrideService.isTourInProgress.mockReturnValue(false);
    service.startRoomTour();
    expect(mockJoyrideService.startTour).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: service.roomStepNames,
        themeColor: '#a855f7',
        showCounter: true,
        showPrevButton: true,
      }),
    );
  });

  it('should not call startTour if already in progress', () => {
    mockJoyrideService.isTourInProgress.mockReturnValue(true);
    service.startMarketplaceTour();
    expect(mockJoyrideService.startTour).not.toHaveBeenCalled();
  });
});