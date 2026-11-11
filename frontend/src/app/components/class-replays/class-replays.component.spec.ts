import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import {
  ClassReplay,
  ClassReplayPlayback,
  ClassReplayService,
} from '../../services/class-replay.service';
import { I18nService } from '../../services/i18n.service';
import { ClassReplaysComponent } from './class-replays.component';

const readyReplay: ClassReplay = {
  id: 'replay-1',
  host_id: 'host-1',
  room_id: 'room-1',
  title: 'Travel phrases',
  description: 'Useful phrases for the airport.',
  status: 'ready',
  hls_url: 'https://media.example.test/replay.m3u8',
  dash_url: 'https://media.example.test/replay.mpd',
  download_url: 'https://media.example.test/replay.mp4',
  thumbnail_url: 'https://media.example.test/thumb.jpg',
  duration_seconds: 125,
  failure_code: null,
  ready_at: '2026-11-11T08:00:00.000Z',
  expires_at: '2027-02-09T08:00:00.000Z',
  created_at: '2026-11-11T08:00:00.000Z',
  updated_at: '2026-11-11T08:00:00.000Z',
};

const failedReplay: ClassReplay = {
  ...readyReplay,
  id: 'replay-2',
  status: 'failed',
  hls_url: null,
  dash_url: null,
  download_url: null,
  failure_code: 'provider_error',
};

const playback: ClassReplayPlayback = {
  replay_id: readyReplay.id,
  status: 'ready',
  hls_url: readyReplay.hls_url,
  dash_url: readyReplay.dash_url,
  download_url: readyReplay.download_url,
  thumbnail_url: readyReplay.thumbnail_url,
  duration_seconds: readyReplay.duration_seconds,
  expires_at: readyReplay.expires_at,
};

describe('ClassReplaysComponent', () => {
  let fixture: ComponentFixture<ClassReplaysComponent>;
  let component: ClassReplaysComponent;

  const replayService = {
    listReplays: vi.fn(),
    getPlayback: vi.fn(),
    retryReplay: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    replayService.listReplays.mockResolvedValue([readyReplay, failedReplay]);
    replayService.getPlayback.mockResolvedValue(playback);
    replayService.retryReplay.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [ClassReplaysComponent],
      providers: [
        provideRouter([]),
        { provide: ClassReplayService, useValue: replayService },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'host-1' }) },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: signal('en-GB'),
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassReplaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('lists the replays returned by the API', () => {
    expect(component.replays()).toEqual([readyReplay, failedReplay]);
    expect(fixture.nativeElement.textContent).toContain('Travel phrases');
  });

  it('loads adaptive playback when a replay is selected', async () => {
    component.selectReplay(readyReplay);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(replayService.getPlayback).toHaveBeenCalledWith('replay-1');
    expect(component.playback()).toEqual(playback);
    const video = fixture.nativeElement.querySelector('video');
    expect(video?.getAttribute('aria-label')).toBe('classReplays.videoLabel');
  });

  it('only offers retry to the host of a failed replay', async () => {
    component.selectReplay(failedReplay);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.canRetrySelected()).toBe(true);
    await component.retrySelected();
    await fixture.whenStable();

    expect(replayService.retryReplay).toHaveBeenCalledWith('replay-2');
    expect(replayService.listReplays).toHaveBeenCalledTimes(2);
  });

  it('renders every action through the shared Spartan button directive', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];

    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.hasAttribute('hlmBtn'))).toBe(true);
  });

  it('formats durations and exposes translated status keys', () => {
    expect(component.formatDuration(125)).toBe('2:05');
    expect(component.formatDuration(null)).toBe('');
    expect(component.statusKey(readyReplay)).toBe('classReplays.status.ready');
    expect(component.hasPlaybackSource(playback)).toBe(true);
    expect(
      component.hasPlaybackSource({
        ...playback,
        hls_url: null,
        dash_url: null,
        download_url: null,
      }),
    ).toBe(false);
  });
});
