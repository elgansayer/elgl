import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { MediaService } from './media.service';
import { PronunciationService } from './pronunciation.service';

describe('PronunciationService', () => {
  let service: PronunciationService;
  let http: HttpTestingController;
  let uploadVoiceNote: ReturnType<typeof vi.fn>;

  const wav = () => new Blob(['RIFF0000WAVE'], { type: 'audio/wav' });

  beforeEach(() => {
    uploadVoiceNote = vi
      .fn()
      .mockResolvedValue({ url: 'https://cdn.example.com/voice.wav' });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MediaService,
          useValue: { uploadVoiceNote },
        },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token-1' },
        },
      ],
    });
    service = TestBed.inject(PronunciationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads the recording and scores it through the NLP endpoint', async () => {
    const promise = firstValueFrom(service.analyse(wav(), '  Hello  '));
    await vi.waitFor(() => expect(uploadVoiceNote).toHaveBeenCalled());

    const request = http.expectOne(
      `${environment.apiUrl}/nlp/pronunciation-score`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      audio_url: 'https://cdn.example.com/voice.wav',
      target_text: 'Hello',
    });
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');

    request.flush({
      overall_score: 92.4,
      breakdown: [
        {
          word: 'Hello',
          score: 90,
          phonemes: [
            { phoneme: 'h', score: 95 },
            { phoneme: 'ə', score: 88 },
          ],
        },
        {
          word: 'Hello',
          score: 94,
          phonemes: [{ phoneme: 'h', score: 99 }],
        },
      ],
      feedback_summary: 'Excellent pronunciation',
      detected_language: 'en-GB',
    });

    await expect(promise).resolves.toEqual({
      score: 92,
      phonemeBreakdown: ['h', 'ə'],
      overallAssessment: 'Excellent pronunciation',
      language: 'en-GB',
    });
  });

  it('rejects a blank target sentence before uploading audio', async () => {
    await expect(
      firstValueFrom(service.analyse(wav(), '   ')),
    ).rejects.toThrow('A target sentence is required to score pronunciation');
    expect(uploadVoiceNote).not.toHaveBeenCalled();
  });

  it('propagates a scoring failure instead of inventing a score', async () => {
    const promise = firstValueFrom(service.analyse(wav(), 'Hello'));
    await vi.waitFor(() => expect(uploadVoiceNote).toHaveBeenCalled());

    http
      .expectOne(`${environment.apiUrl}/nlp/pronunciation-score`)
      .flush(
        { message: 'Pronunciation scoring is temporarily unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    await expect(promise).rejects.toBeTruthy();
  });

  it('refuses a recording it cannot convert for the assessment provider', async () => {
    await expect(
      firstValueFrom(
        service.analyse(new Blob(['webm'], { type: 'audio/webm' }), 'Hello'),
      ),
    ).rejects.toBeTruthy();
    expect(uploadVoiceNote).not.toHaveBeenCalled();
  });
});
