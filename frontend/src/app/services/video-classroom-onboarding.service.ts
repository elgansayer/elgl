import { Injectable, signal, inject } from '@angular/core';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

const STORAGE_KEY = 'hellotalk_video_classroom_onboarding_done';

export interface VideoClassroomOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the Video Classrooms feature.
 * Steps correspond to `joyrideStep` directive names in the template.
 */
@Injectable({ providedIn: 'root' })
export class VideoClassroomOnboardingService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);

  readonly isTourInProgress = signal(false);

  readonly steps: VideoClassroomOnboardingStep[] = [
    {
      key: 'videoClassroomStepMarketplace',
      title: 'Video Classrooms',
      text: 'Browse live video language-learning sessions hosted by community members. Join a room to practise speaking with native speakers.',
    },
    {
      key: 'videoClassroomStepFilters',
      title: 'Filter by Language',
      text: 'Use these language filters to find classrooms focused on the language pair you want to practise.',
    },
    {
      key: 'videoClassroomStepRoomCard',
      title: 'Join a Classroom',
      text: 'Each card shows a live classroom. Tap "Join Classroom" to enter and start participating in the video session.',
    },
    {
      key: 'videoClassroomStepHostVideo',
      title: 'Host Video',
      text: 'The host video stream is displayed here. You can watch the host and interact via the live chat overlay.',
    },
    {
      key: 'videoClassroomStepCoHost',
      title: 'Split Screen',
      text: 'When a co-host is invited, they appear in a split-screen view alongside the host for collaborative teaching.',
    },
    {
      key: 'videoClassroomStepInviteCoHost',
      title: 'Invite Co-Host',
      text: 'As the host, you can invite an approved speaker to become your co-host and share the screen.',
    },
  ];

  get stepNames(): string[] {
    return this.steps.map((s) => s.key);
  }

  /** Marketplace-only steps (used on the listing page). */
  get marketplaceStepNames(): string[] {
    return ['videoClassroomStepMarketplace', 'videoClassroomStepFilters', 'videoClassroomStepRoomCard'];
  }

  /** Room-only steps (used inside an active video room). */
  get roomStepNames(): string[] {
    return ['videoClassroomStepHostVideo', 'videoClassroomStepCoHost', 'videoClassroomStepInviteCoHost'];
  }

  startMarketplaceTour(): void {
    if (this.joyrideService.isTourInProgress()) return;
    this.isTourInProgress.set(true);

    this.joyrideService.startTour({
      steps: this.marketplaceStepNames,
      stepDefaultPosition: 'bottom',
      themeColor: '#a855f7',
      showCounter: true,
      showPrevButton: true,
      customTexts: {
        prev: this.i18n.translate('tour.prev'),
        next: this.i18n.translate('tour.next'),
        done: this.i18n.translate('tour.done'),
        close: this.i18n.translate('tour.close'),
      },
    }).subscribe({
      complete: () => this.markComplete(),
      error: () => this.isTourInProgress.set(false),
    });
  }

  startRoomTour(): void {
    if (this.joyrideService.isTourInProgress()) return;
    this.isTourInProgress.set(true);

    this.joyrideService.startTour({
      steps: this.roomStepNames,
      stepDefaultPosition: 'bottom',
      themeColor: '#a855f7',
      showCounter: true,
      showPrevButton: true,
      customTexts: {
        prev: this.i18n.translate('tour.prev'),
        next: this.i18n.translate('tour.next'),
        done: this.i18n.translate('tour.done'),
        close: this.i18n.translate('tour.close'),
      },
    }).subscribe({
      complete: () => this.markComplete(),
      error: () => this.isTourInProgress.set(false),
    });
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  reset(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable, ignore
    }
  }
}