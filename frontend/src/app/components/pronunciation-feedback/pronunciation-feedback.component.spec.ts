import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi, type Mock } from 'vitest';

import { PronunciationFeedbackComponent } from './pronunciation-feedback.component';
import {
  PronunciationService,
  PronunciationFeedback,
} from '../../services/pronunciation.service';
import { I18nService } from '../../services/i18n.service';

describe('PronunciationFeedbackComponent', () => {
  let component: PronunciationFeedbackComponent;
  let fixture: ComponentFixture<PronunciationFeedbackComponent>;
  let pronunciationServiceMock: { analyse: Mock };
  let i18nServiceMock: { translate: Mock };

  const feedback: PronunciationFeedback = {
    score: 92,
    overallAssessment: 'Excellent',
    phonemeBreakdown: ['h', 'e', 'l', 'l', 'o'],
    language: 'en',
  };

  beforeEach(async () => {
    pronunciationServiceMock = {
      analyse: vi.fn().mockReturnValue(of(feedback)),
    };
    i18nServiceMock = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    // Mock MediaRecorder and getUserMedia for every test
    class MockedMediaRecorder {
      state = 'inactive';
      ondataavailable: ((event: any) => void) | null = null;
      onstop: (() => void) | null = null;
      start(): void {
        this.state = 'recording';
      }
      stop(): void {
        this.state = 'inactive';
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob(['audio'], { type: 'audio/webm' }) });
        }
        if (this.onstop) {
          this.onstop();
        }
      }
    }

    const streamMock = {
      getTracks: () => [{ stop: () => {} }],
    };

    Object.defineProperty(window, 'MediaRecorder', {
      writable: true,
      configurable: true,
      value: MockedMediaRecorder,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(streamMock),
      },
    });

    await TestBed.configureTestingModule({
      imports: [PronunciationFeedbackComponent, FormsModule],
      providers: [
        { provide: PronunciationService, useValue: pronunciationServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PronunciationFeedbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with isRecording false, feedback null, and empty sentence', () => {
      expect(component.isRecording()).toBe(false);
      expect(component.feedback()).toBeNull();
      expect(component.sentence()).toBe('');
    });
  });

  describe('startRecording', () => {
    it('should set isRecording to true after obtaining an audio stream', async () => {
      await component.startRecording();
      expect(component.isRecording()).toBe(true);
    });

    it('should clear any previous feedback when starting a new recording', async () => {
      component.feedback.set(feedback);
      await component.startRecording();
      expect(component.feedback()).toBeNull();
    });
  });

  describe('stopRecording', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call pronunciationService.analyse with a Blob and the sentence', async () => {
      component.sentence.set('Hello world');
      await component.startRecording();

      vi.useFakeTimers();
      component.stopRecording();
      vi.advanceTimersByTime(200);

      expect(pronunciationServiceMock.analyse).toHaveBeenCalledTimes(1);

      const [blobArg, refArg] =
        pronunciationServiceMock.analyse.mock.calls[0] as [Blob, string | undefined];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(refArg).toBe('Hello world');
    });

    it('should set feedback from the service result', async () => {
      component.sentence.set('Hello');
      await component.startRecording();

      vi.useFakeTimers();
      component.stopRecording();
      vi.advanceTimersByTime(200);

      expect(component.feedback()).toEqual(feedback);
    });

    it('should not call analyse when there are no audio chunks', () => {
      // No prior startRecording so mediaRecorder is null and audioChunks is empty.
      vi.useFakeTimers();
      component.stopRecording();
      vi.advanceTimersByTime(200);

      expect(pronunciationServiceMock.analyse).not.toHaveBeenCalled();
      expect(component.isRecording()).toBe(false);
    });
  });

  describe('error handling', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should keep feedback null when the service throws an error', async () => {
      pronunciationServiceMock.analyse.mockReturnValue(
        throwError(() => new Error('network error')),
      );

      await component.startRecording();

      vi.useFakeTimers();
      component.stopRecording();
      vi.advanceTimersByTime(200);

      expect(component.feedback()).toBeNull();
      expect(component.isRecording()).toBe(false);
    });
  });
});
