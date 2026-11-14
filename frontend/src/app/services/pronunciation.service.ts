import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { MediaService } from './media.service';

export interface PronunciationFeedback {
  score: number;
  phonemeBreakdown: string[];
  overallAssessment: string;
  language: string;
}

interface PronunciationWordBreakdown {
  word: string;
  score: number;
  phonemes?: Array<{ phoneme: string; score: number }>;
}

interface PronunciationScoreResult {
  overall_score: number;
  breakdown: PronunciationWordBreakdown[];
  feedback_summary: string;
  detected_language?: string;
  transcription?: string;
}

const TARGET_SAMPLE_RATE = 16000;

/**
 * Scores recorded speech through the canonical NLP pronunciation endpoint.
 * The browser recording is resampled to the 16 kHz mono WAV the Azure Speech
 * assessment accepts, uploaded to R2, then scored server-side. A scoring
 * failure is surfaced as an error so no fabricated score reaches the UI.
 */
@Injectable({ providedIn: 'root' })
export class PronunciationService {
  private readonly http = inject(HttpClient);
  private readonly media = inject(MediaService);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/nlp/pronunciation-score`;

  analyse(audio: Blob, targetText: string): Observable<PronunciationFeedback> {
    const trimmed = targetText.trim();
    if (!trimmed) {
      return from(
        Promise.reject(new Error('A target sentence is required to score pronunciation')),
      );
    }
    return from(this.score(audio, trimmed));
  }

  private async score(
    audio: Blob,
    targetText: string,
  ): Promise<PronunciationFeedback> {
    const wav = await this.toAssessmentAudio(audio);
    const upload = await this.media.uploadVoiceNote(wav);

    const result = await firstValueFrom(
      this.http.post<PronunciationScoreResult>(
        this.apiUrl,
        {
          audio_url: upload.url,
          target_text: targetText,
        },
        {
          headers: {
            Authorization: `Bearer ${this.auth.getAccessToken() ?? ''}`,
          },
        },
      ),
    );

    const phonemes = result.breakdown.flatMap((word) =>
      (word.phonemes ?? []).map((phoneme) => phoneme.phoneme),
    );

    return {
      score: Math.round(result.overall_score),
      phonemeBreakdown: [...new Set(phonemes)],
      overallAssessment: result.feedback_summary,
      language: result.detected_language ?? 'en',
    };
  }

  private async toAssessmentAudio(audio: Blob): Promise<Blob> {
    const mime = audio.type.split(';', 1)[0].trim().toLowerCase();
    if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') {
      return audio;
    }
    if (
      typeof AudioContext === 'undefined' ||
      typeof OfflineAudioContext === 'undefined'
    ) {
      throw new Error('This browser cannot convert the recording for scoring');
    }

    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await audio.arrayBuffer());
      const frameCount = Math.max(
        1,
        Math.ceil(decoded.duration * TARGET_SAMPLE_RATE),
      );
      const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
      const source = offline.createBufferSource();
      source.buffer = decoded;
      source.connect(offline.destination);
      source.start();
      const rendered = await offline.startRendering();
      return new Blob([this.encodePcm16Wav(rendered)], { type: 'audio/wav' });
    } finally {
      await context.close();
    }
  }

  private encodePcm16Wav(buffer: AudioBuffer): ArrayBuffer {
    const samples = buffer.getChannelData(0);
    const bytes = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(bytes);
    const writeAscii = (offset: number, text: string) => {
      for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index));
      }
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (const sample of samples) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      );
      offset += 2;
    }
    return bytes;
  }
}
