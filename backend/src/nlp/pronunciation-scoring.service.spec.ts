import { ConfigService } from '@nestjs/config';
import type { Mock } from 'vitest';
import { PronunciationScoringService } from './pronunciation-scoring.service';

const AUDIO_URL = 'https://media.example.com/pronunciation/sample.wav';

function createService(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    AZURE_SPEECH_KEY: 'speech-key',
    AZURE_SPEECH_REGION: 'westeurope',
    AZURE_TRANSLATOR_KEY: 'translator-key-must-not-be-used',
    CLOUDFLARE_R2_PUBLIC_URL: 'https://media.example.com',
    CLOUDFLARE_R2_SOURCE_HOSTS: 'recordings.example.com',
    ...overrides,
  };
  const config = {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new PronunciationScoringService(config);
}

function audioResponse(
  body = new Uint8Array([1, 2, 3, 4]),
  contentType = 'audio/wav',
) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-length': String(body.byteLength),
    },
  });
}

function azureResponse() {
  return new Response(
    JSON.stringify({
      RecognitionStatus: 'Success',
      DisplayText: 'Hello world.',
      NBest: [
        {
          PronunciationAssessment: {
            AccuracyScore: 91.4,
            FluencyScore: 86,
            CompletenessScore: 100,
            PronScore: 92.2,
          },
          Words: [
            {
              Word: 'hello',
              PronunciationAssessment: {
                AccuracyScore: 94.6,
                ErrorType: 'None',
              },
              Phonemes: [
                {
                  Phoneme: 'h',
                  PronunciationAssessment: {
                    AccuracyScore: 97.2,
                    NBestPhonemes: [
                      { Phoneme: 'h', Score: 99 },
                      { Phoneme: 'f', Score: 12 },
                    ],
                  },
                },
                {
                  Phoneme: 'ɛ',
                  PronunciationAssessment: {
                    AccuracyScore: 61.2,
                    NBestPhonemes: [
                      { Phoneme: 'ə', Score: 72 },
                      { Phoneme: 'ɛ', Score: 61 },
                    ],
                  },
                },
              ],
            },
            {
              Word: 'world',
              PronunciationAssessment: {
                AccuracyScore: 83.4,
                ErrorType: 'Mispronunciation',
              },
              Phonemes: [
                {
                  Phoneme: 'w',
                  PronunciationAssessment: {
                    AccuracyScore: 83.4,
                    NBestPhonemes: [{ Phoneme: 'w', Score: 83 }],
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('PronunciationScoringService', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a scripted HundredMark phoneme assessment and maps real Azure scores', async () => {
    const service = createService();
    (global.fetch as Mock)
      .mockResolvedValueOnce(audioResponse())
      .mockResolvedValueOnce(azureResponse());

    const result = await service.score({
      audio_url: AUDIO_URL,
      target_text: ' Hello world. ',
      language: 'en-US',
    });

    expect(result).toEqual({
      overall_score: 92,
      detected_language: 'en-US',
      transcription: 'Hello world.',
      feedback_summary: 'Excellent pronunciation!',
      breakdown: [
        {
          word: 'hello',
          score: 95,
          feedback: 'Excellent',
          phonemes: [
            {
              phoneme: 'h',
              expected_phoneme: 'h',
              score: 97,
              feedback: 'Native-like',
            },
            {
              phoneme: 'ə',
              expected_phoneme: 'ɛ',
              score: 61,
              feedback: 'Needs practice',
            },
          ],
        },
        {
          word: 'world',
          score: 83,
          feedback: 'Azure assessment: Mispronunciation',
          phonemes: [
            {
              phoneme: 'w',
              expected_phoneme: 'w',
              score: 83,
              feedback: 'Acceptable',
            },
          ],
        },
      ],
    });

    const [, providerRequest] = (global.fetch as Mock).mock.calls;
    const providerUrl = providerRequest[0] as URL;
    const init = providerRequest[1] as RequestInit;
    expect(providerUrl.hostname).toBe(
      'westeurope.stt.speech.microsoft.com',
    );
    expect(providerUrl.searchParams.get('language')).toBe('en-US');
    expect(providerUrl.searchParams.get('format')).toBe('detailed');
    expect(init.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'speech-key',
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      Accept: 'application/json',
    });

    const encodedAssessment = (init.headers as Record<string, string>)[
      'Pronunciation-Assessment'
    ];
    expect(JSON.parse(Buffer.from(encodedAssessment, 'base64').toString('utf8')))
      .toEqual({
        ReferenceText: 'Hello world.',
        GradingSystem: 'HundredMark',
        Granularity: 'Phoneme',
        Dimension: 'Comprehensive',
        EnableMiscue: true,
        NBestPhonemeCount: 3,
      });
    expect(JSON.stringify(init.headers)).not.toContain(
      'translator-key-must-not-be-used',
    );
  });

  it('accepts an explicitly configured source host and sends OGG as Opus', async () => {
    const service = createService();
    (global.fetch as Mock)
      .mockResolvedValueOnce(audioResponse(undefined, 'audio/ogg; codecs=opus'))
      .mockResolvedValueOnce(azureResponse());

    await service.score({
      audio_url: 'https://recordings.example.com/sample.ogg',
      target_text: 'Hello world',
    });

    const init = (global.fetch as Mock).mock.calls[1][1] as RequestInit;
    expect(init.headers).toMatchObject({
      'Content-Type': 'audio/ogg; codecs=opus',
    });
  });

  it('rejects arbitrary audio hosts before making a network request', async () => {
    const service = createService();

    await expect(
      service.score({
        audio_url: 'https://attacker.example/audio.wav',
        target_text: 'Hello',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsupported media types instead of lying to Azure about the codec', async () => {
    const service = createService();
    (global.fetch as Mock).mockResolvedValueOnce(
      audioResponse(undefined, 'audio/webm; codecs=opus'),
    );

    await expect(
      service.score({ audio_url: AUDIO_URL, target_text: 'Hello' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized audio from content-length before reading the body', async () => {
    const service = createService();
    (global.fetch as Mock).mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: {
          'content-type': 'audio/wav',
          'content-length': String(2 * 1024 * 1024 + 1),
        },
      }),
    );

    await expect(
      service.score({ audio_url: AUDIO_URL, target_text: 'Hello' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when Azure credentials are missing', async () => {
    const service = createService({ AZURE_SPEECH_KEY: '' });

    await expect(
      service.score({ audio_url: AUDIO_URL, target_text: 'Hello' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a stable unavailable response when Azure omits real assessment scores', async () => {
    const service = createService();
    (global.fetch as Mock)
      .mockResolvedValueOnce(audioResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            RecognitionStatus: 'Success',
            DisplayText: 'Hello',
            NBest: [{ Words: [{ Word: 'hello' }] }],
          }),
          { status: 200 },
        ),
      );

    await expect(
      service.score({ audio_url: AUDIO_URL, target_text: 'Hello' }),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        message: 'Pronunciation scoring is temporarily unavailable',
      },
    });
  });

  it('does not expose Azure response bodies when the provider rejects a request', async () => {
    const service = createService();
    (global.fetch as Mock)
      .mockResolvedValueOnce(audioResponse())
      .mockResolvedValueOnce(
        new Response('sensitive provider diagnostic', { status: 503 }),
      );

    await expect(
      service.score({ audio_url: AUDIO_URL, target_text: 'Hello' }),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        message: 'Pronunciation scoring is temporarily unavailable',
      },
    });
  });
});