import { ConfigService } from '@nestjs/config';
import { SpeechTranscriptionService } from './speech-transcription.service';

function service(values: Record<string, string | undefined>) {
  const config = {
    get: vi.fn((key: string) => values[key]),
  };
  return new SpeechTranscriptionService(config as unknown as ConfigService);
}

describe('SpeechTranscriptionService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports provider unavailability without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({ AZURE_SPEECH_REGION: 'westeurope' });

    await expect(
      transcription.transcribeAudioUrl('https://media.example/voice.webm'),
    ).resolves.toEqual({ status: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates, polls, reads and deletes one Azure batch transcription job', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T10:00:00.000Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            self: 'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/1',
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'Succeeded',
            links: {
              files:
                'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/1/files',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            values: [
              {
                kind: 'Transcription',
                links: {
                  contentUrl:
                    'https://results.blob.core.windows.net/transcriptions/1',
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            combinedRecognizedPhrases: [
              { display: ' Hello world. ' },
              { display: 'How are you?' },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
      AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS: '60000',
    });

    const result = transcription.transcribeAudioUrl(
      'https://media.example/voice.webm',
    );
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toEqual({
      status: 'ready',
      transcript: 'Hello world.\nHow are you?',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const createBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(createBody).toMatchObject({
      contentUrls: ['https://media.example/voice.webm'],
      locale: 'en-US',
    });
  });

  it('returns a sanitised failure code when Azure rejects job creation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('private provider detail', { status: 503 }),
        ),
    );
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
    });

    await expect(
      transcription.transcribeAudioUrl('https://media.example/voice.webm'),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'provider_rejected',
    });
  });

  it('distinguishes a successful empty recognition result', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T10:00:00.000Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            self: 'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/2',
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'Succeeded',
            links: {
              files:
                'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/2/files',
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            values: [
              {
                kind: 'Transcription',
                links: {
                  contentUrl:
                    'https://results.blob.core.windows.net/transcriptions/2',
                },
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ combinedRecognizedPhrases: [] })),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
      AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS: '60000',
    });

    const result = transcription.transcribeAudioUrl(
      'https://media.example/voice.webm',
    );
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toEqual({ status: 'empty' });
  });

  it('rejects non-HTTPS and invalid audio URLs without contacting provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
    });

    await expect(
      transcription.transcribeAudioUrl('http://insecure.example/voice.webm'),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_audio_url',
    });

    await expect(
      transcription.transcribeAudioUrl('javascript:alert(1)'),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_audio_url',
    });

    await expect(
      transcription.transcribeAudioUrl('not-a-valid-url'),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_audio_url',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-HTTPS job reference returned by provider without sending secrets', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ self: 'http://insecure.example/jobs/3' }), {
        status: 201,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
    });

    await expect(
      transcription.transcribeAudioUrl('https://media.example/voice.webm'),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_provider_response',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://insecure.example/jobs/3',
      expect.anything(),
    );
  });

  it('rejects an off-origin HTTPS job reference without forwarding the speech key', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          self: 'https://attacker.example/speechtotext/v3.1/transcriptions/jobs/4',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
    });

    await expect(
      transcription.transcribeAudioUrl('https://media.example/voice.webm'),
    ).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_provider_response',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('attacker.example'),
      expect.anything(),
    );
  });

  it('rejects an off-origin result-list URL without forwarding the speech key', async () => {
    vi.useFakeTimers();
    const jobUrl =
      'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/5';
    const untrustedFilesUrl =
      'https://attacker.example/speechtotext/v3.1/transcriptions/jobs/5/files';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ self: jobUrl }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'Succeeded',
            links: { files: untrustedFilesUrl },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
      AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS: '60000',
    });

    const result = transcription.transcribeAudioUrl(
      'https://media.example/voice.webm',
    );
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toEqual({
      status: 'failed',
      errorCode: 'provider_job_failed',
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      untrustedFilesUrl,
      expect.anything(),
    );
  });

  it('rejects a non-Azure result URL without fetching it', async () => {
    vi.useFakeTimers();
    const jobUrl =
      'https://westeurope.api.cognitive.microsoft.com/speechtotext/v3.1/transcriptions/jobs/5';
    const filesUrl = `${jobUrl}/files`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ self: jobUrl }), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'Succeeded', links: { files: filesUrl } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            values: [
              {
                kind: 'Transcription',
                links: { contentUrl: 'https://attacker.example/result' },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const transcription = service({
      AZURE_SPEECH_KEY: 'speech-key',
      AZURE_SPEECH_REGION: 'westeurope',
      AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS: '60000',
    });

    const result = transcription.transcribeAudioUrl(
      'https://media.example/voice.webm',
    );
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toEqual({
      status: 'failed',
      errorCode: 'invalid_provider_response',
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://attacker.example/result',
      expect.anything(),
    );
  });
});
