import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { AudioRoomArchiveComponent } from './audio-room-archive.component';
import {
  AudioRoomArchiveSummary,
  AudioRoomArchivesService,
} from '../../services/audio-room-archives.service';
import { I18nService } from '../../services/i18n.service';

class MockI18nService {
  readonly currentLang = signal('en-GB');

  translate(key: string): string {
    return key;
  }
}

describe('AudioRoomArchiveComponent', () => {
  let fixture: ComponentFixture<AudioRoomArchiveComponent>;
  let service: {
    list: ReturnType<typeof vi.fn>;
    getSummary: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
  };

  const archive = {
    id: 'room-1',
    title: 'Japanese practice',
    language_pair: 'en-ja',
    topic_tag: 'travel',
    host_id: 'host-1',
    is_private: false,
    recording_url: 'https://media.example.test/room-1.mp3',
    created_at: '2026-08-20T12:00:00.000Z',
    summary_status: 'ready' as const,
  };

  const readySummary: AudioRoomArchiveSummary = {
    room_id: 'room-1',
    recording_url: archive.recording_url,
    transcript_text: 'We talked about buying train tickets.',
    session_summary: '• Buying train tickets',
    vocabulary: ['ticket', 'platform'],
    summary_status: 'ready',
    summary_attempts: 1,
    updated_at: '2026-08-20T12:01:00.000Z',
  };

  beforeEach(async () => {
    service = {
      list: vi.fn().mockResolvedValue([archive]),
      getSummary: vi.fn().mockResolvedValue(readySummary),
      retry: vi.fn().mockResolvedValue({ queued: true }),
    };

    await TestBed.configureTestingModule({
      imports: [AudioRoomArchiveComponent],
      providers: [
        { provide: AudioRoomArchivesService, useValue: service },
        { provide: I18nService, useClass: MockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioRoomArchiveComponent);
  });

  it('renders archived rooms and a ready summary with vocabulary', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Japanese practice');

    fixture.componentInstance.selectRoom('room-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getSummary).toHaveBeenCalledWith('room-1');
    expect(fixture.nativeElement.textContent).toContain('Buying train tickets');
    expect(fixture.nativeElement.textContent).toContain('ticket');
    expect(fixture.nativeElement.textContent).toContain('platform');
    expect(fixture.nativeElement.querySelector('audio')).not.toBeNull();
  });

  it('shows processing state without requesting a second generation', async () => {
    service.getSummary.mockResolvedValue({
      ...readySummary,
      recording_url: null,
      transcript_text: null,
      session_summary: null,
      vocabulary: [],
      summary_status: 'processing',
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.selectRoom('room-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('common.loading');
    expect(service.retry).not.toHaveBeenCalled();
  });

  it('lets a host retry a failed summary and reloads server state', async () => {
    service.getSummary.mockResolvedValue({
      ...readySummary,
      session_summary: null,
      vocabulary: [],
      summary_status: 'failed',
      summary_attempts: 4,
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.selectRoom('room-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.retry('room-1');

    expect(service.retry).toHaveBeenCalledWith('room-1');
    expect(fixture.componentInstance.retrying()).toBe(false);
  });
});
