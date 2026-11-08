import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { CloudflareStreamService } from '../cloudflare-stream/cloudflare-stream.service';
import { SpeechTranscriptionService } from '../nlp/speech-transcription.service';
import { TranscriptEgressService } from './transcript-egress.service';

describe('TranscriptEgressService', () => {
  function createHarness(
    result:
      | {
          status: 'ready';
          transcript: string;
        }
      | {
          status: 'failed';
          errorCode: string;
        },
  ) {
    const config = {
      get: vi.fn((key: string) => {
        const values: Record<string, string> = {
          LIVEKIT_URL: 'https://livekit.example.test',
          LIVEKIT_API_KEY: 'test-key',
          LIVEKIT_SECRET: 'test-secret',
          NODE_ENV: 'test',
        };
        return values[key];
      }),
    };
    const speechTranscription = {
      transcribeAudioUrl: vi.fn().mockResolvedValue(result),
    };
    const service = new TranscriptEgressService(
      config as unknown as ConfigService,
      {} as CloudflareStreamService,
      speechTranscription as unknown as SpeechTranscriptionService,
      {} as PinoLogger,
    );

    return { service, speechTranscription };
  }

  it('returns the shared provider transcript for a ready result', async () => {
    const { service, speechTranscription } = createHarness({
      status: 'ready',
      transcript: 'Archived room transcript',
    });

    await expect(
      service.generateTranscriptFromAudioUrl('https://media.example/audio.wav'),
    ).resolves.toBe('Archived room transcript');
    expect(speechTranscription.transcribeAudioUrl).toHaveBeenCalledWith(
      'https://media.example/audio.wav',
    );
  });

  it('preserves the existing empty-string fallback for provider failures', async () => {
    const { service } = createHarness({
      status: 'failed',
      errorCode: 'provider_request_failed',
    });

    await expect(
      service.generateTranscriptFromAudioUrl('https://media.example/audio.wav'),
    ).resolves.toBe('');
  });
});
