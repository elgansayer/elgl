import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { PronunciationFeedbackComponent } from './pronunciation-feedback.component';
import {
  PronunciationService,
  PronunciationFeedback,
} from '../../services/pronunciation.service';
import { I18nService } from '../../services/i18n.service';

describe('PronunciationFeedbackComponent', () => {
  let component: PronunciationFeedbackComponent;
  let fixture: ComponentFixture<PronunciationFeedbackComponent>;
  let pronunciationServiceMock: { analyse: vi.Mock };
  let i18nServiceMock: { translate: vi.Mock };

  const feedback: PronunciationFeedback = {
    score: 92,
    overallAssessment: 'Excellent',
    phonemeBreakdown: ['h', 'e', 'l', 'l', 'o'],
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
    it('should set isRecording to true after obtaining an audio stream', fakeAsync(() => {
      component.startRecording();
      tick();
      expect(component.isRecording()).toBe(true);
    }));

    it('should clear any previous feedback when starting a new recording', fakeAsync(() => {
      component.feedback.set(feedback);
      component.startRecording();
      tick();
      expect(component.feedback()).toBeNull();
    }));
  });

  describe('stopRecording', () => {
    it('should call pronunciationService.analyse with a Blob and the sentence', fakeAsync(() => {
      component.sentence.set('Hello world');
      component.startRecording();
      tick();

      component.stopRecording();
      tick(200);

      expect(pronunciationServiceMock.analyse).toHaveBeenCalledTimes(1);

      const [blobArg, refArg] =
        pronunciationServiceMock.analyse.mock.calls[0] as [Blob, string | undefined];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(refArg).toBe('Hello world');
    }));

    it('should set feedback from the service result', fakeAsync(() => {
      component.sentence.set('Hello');
      component.startRecording();
      tick();

      component.stopRecording();
      tick(200);

      expect(component.feedback()).toEqual(feedback);
    }));

    it('should not call analyse when there are no audio chunks', fakeAsync(() => {
      // No prior startRecording so mediaRecorder is null and audioChunks is empty.
      component.stopRecording();
      tick(200);

      expect(pronunciationServiceMock.analyse).not.toHaveBeenCalled();
      expect(component.isRecording()).toBe(false);
    }));
  });

  describe('error handling', () => {
    it('should keep feedback null when the service throws an error', fakeAsync(() => {
      pronunciationServiceMock.analyse.mockReturnValue(
        throwError(() => new Error('network error')),
      );

      component.startRecording();
      tick();

      component.stopRecording();
      tick(200);

      expect(component.feedback()).toBeNull();
      expect(component.isRecording()).toBe(false);
    }));
  });
});
