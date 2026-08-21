import { TestBed } from '@angular/core/testing';
import { VideoClassroomOnboardingService } from './video-classroom-onboarding.service';

describe('VideoClassroomOnboardingService', () => {
  let service: VideoClassroomOnboardingService;

  beforeEach(() => {
    window.localStorage.removeItem('hellotalk_video_classroom_onboarding_done');
    TestBed.configureTestingModule({});
    service = TestBed.inject(VideoClassroomOnboardingService);
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

  it('should mark complete when startMarketplaceTour is called', () => {
    service.startMarketplaceTour();
    expect(service.isCompleted()).toBe(true);
  });

  it('should mark complete when startRoomTour is called', () => {
    service.startRoomTour();
    expect(service.isCompleted()).toBe(true);
  });
});