import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PronunciationScoreDto } from './dto/pronunciation-score.dto';
import {
  PhonemeScore,
  PronunciationScoreResult,
  WordBreakdownItem,
} from './interfaces/nlp-results.interface';

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;
const ALLOWED_AUDIO_TYPES = new Map<string, string>([
  ['audio/wav', 'audio/wav; codecs=audio/pcm; samplerate=16000'],
  ['audio/x-wav', 'audio/wav; codecs=audio/pcm; samplerate=16000'],
  ['audio/wave', 'audio/wav; codecs=audio/pcm; samplerate=16000'],
  ['audio/ogg', 'audio/ogg; codecs=opus'],
]);

interface AzurePhonemeAssessment {
  AccuracyScore?: number;
  NBestPhonemes?: Array<{
    Phoneme?: string;
    Score?: number;
  }>;
}

interface AzurePronunciationResponse {
  RecognitionStatus?: string | number;
  DisplayText?: string;
  NBest?: Array<{
    PronunciationAssessment?: {
      AccuracyScore?: number;
      FluencyScore?: number;
      CompletenessScore?: number;
      ProsodyScore?: number;
      PronScore?: number;
    };
    Words?: Array<{
      Word?: string;
      PronunciationAssessment?: {
        AccuracyScore?: number;
        ErrorType?: string;
      };
      Phonemes?: Array<{
        Phoneme?: string;
        PronunciationAssessment?: AzurePhonemeAssessment;
      }>;
    }>;
  }>;
}

interface DownloadedAudio {
  bytes: Uint8Array;
  azureContentType: string;
}

@Injectable()
export class PronunciationScoringService {
  private readonly logger = new Logger(PronunciationScoringService.name);

  constructor(private readonly configService: ConfigService) {}

  async score(dto: PronunciationScoreDto): Promise<PronunciationScoreResult> {
    const targetText = dto.target_text.trim();
    if (!targetText) {
      throw new BadRequestException('Target text must not be blank');
    }

    const language = (dto.language || 'en-US').trim();
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)) {
      throw new BadRequestException('Language must be a valid BCP 47 language tag');
    }

    const speechKey = this.configService.get<string>('AZURE_SPEECH_KEY')?.trim();
    const region = this.configService
      .get<string>('AZURE_SPEECH_REGION')
      ?.trim()
      .toLowerCase();
    if (!speechKey || !region || !/^[a-z0-9-]+$/.test(region)) {
      this.logger.error('Azure pronunciation scoring is not configured');
      throw new ServiceUnavailableException(
        'Pronunciation scoring is temporarily unavailable',
      );
    }

    const audio = await this.downloadAudio(dto.audio_url);
    const assessmentHeader = Buffer.from(
      JSON.stringify({
        ReferenceText: targetText,
        GradingSystem: 'HundredMark',
        Granularity: 'Phoneme',
        Dimension: 'Comprehensive',
        EnableMiscue: true,
        NBestPhonemeCount: 3,
      }),
      'utf8',
    ).toString('base64');

    const endpoint = new URL(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
    );
    endpoint.searchParams.set('language', language);
    endpoint.searchParams.set('format', 'detailed');
    endpoint.searchParams.set('profanity', 'masked');

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': speechKey,
          'Pronunciation-Assessment': assessmentHeader,
          'Content-Type': audio.azureContentType,
          Accept: 'application/json',
        },
        body: Buffer.from(audio.bytes),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      this.logger.warn({ region }, 'Azure pronunciation request failed');
      throw new ServiceUnavailableException(
        'Pronunciation scoring is temporarily unavailable',
      );
    }

    if (!response.ok) {
      this.logger.warn(
        { region, status: response.status },
        'Azure pronunciation request was rejected',
      );
      if (response.status === 400 || response.status === 415) {
        throw new BadRequestException(
          'Audio must be a supported 16 kHz mono WAV or OGG/Opus sample',
        );
      }
      throw new ServiceUnavailableException(
        'Pronunciation scoring is temporarily unavailable',
      );
    }

    let result: AzurePronunciationResponse;
    try {
      result = (await response.json()) as AzurePronunciationResponse;
    } catch {
      this.logger.warn({ region }, 'Azure pronunciation response was invalid');
      throw new ServiceUnavailableException(
        'Pronunciation scoring is temporarily unavailable',
      );
    }

    return this.toResult(result, language, region);
  }

  private async downloadAudio(audioUrl: string): Promise<DownloadedAudio> {
    const url = this.validateAudioUrl(audioUrl);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      throw new BadRequestException('Audio source could not be read');
    }

    if (!response.ok) {
      throw new BadRequestException('Audio source could not be read');
    }

    const declaredLength = response.headers.get('content-length');
    if (declaredLength) {
      const parsedLength = Number(declaredLength);
      if (
        !Number.isSafeInteger(parsedLength) ||
        parsedLength < 1 ||
        parsedLength > MAX_AUDIO_BYTES
      ) {
        throw new BadRequestException('Audio sample is too large');
      }
    }

    const mimeType = (response.headers.get('content-type') || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const azureContentType = ALLOWED_AUDIO_TYPES.get(mimeType);
    if (!azureContentType) {
      throw new BadRequestException(
        'Audio must be a supported WAV or OGG/Opus sample',
      );
    }

    const bytes = await this.readBoundedBody(response);
    if (bytes.byteLength === 0) {
      throw new BadRequestException('Audio sample is empty');
    }

    return { bytes, azureContentType };
  }

  private validateAudioUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Audio URL is invalid');
    }

    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new BadRequestException('Audio URL must be a trusted HTTPS URL');
    }

    const allowedHosts = this.getAllowedAudioHosts();
    if (allowedHosts.size === 0 || !allowedHosts.has(url.hostname.toLowerCase())) {
      throw new BadRequestException('Audio URL is not from an approved media host');
    }

    return url;
  }

  private getAllowedAudioHosts(): Set<string> {
    const hosts = new Set<string>();
    const publicUrl = this.configService
      .get<string>('CLOUDFLARE_R2_PUBLIC_URL')
      ?.trim();
    if (publicUrl) {
      try {
        hosts.add(new URL(publicUrl).hostname.toLowerCase());
      } catch {
        // Startup configuration validation owns malformed URL diagnostics.
      }
    }

    const sourceHosts =
      this.configService.get<string>('CLOUDFLARE_R2_SOURCE_HOSTS') || '';
    for (const host of sourceHosts.split(',')) {
      const normalised = host.trim().toLowerCase();
      if (/^[a-z0-9.-]+$/.test(normalised)) {
        hosts.add(normalised);
      }
    }
    return hosts;
  }

  private async readBoundedBody(response: Response): Promise<Uint8Array> {
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_AUDIO_BYTES) {
        throw new BadRequestException('Audio sample is too large');
      }
      return bytes;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AUDIO_BYTES) {
        await reader.cancel('Audio sample exceeds size limit');
        throw new BadRequestException('Audio sample is too large');
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  private toResult(
    result: AzurePronunciationResponse,
    language: string,
    region: string,
  ): PronunciationScoreResult {
    const best = result.NBest?.[0];
    const overallAssessment = best?.PronunciationAssessment;
    const overallScore = this.normaliseScore(
      overallAssessment?.PronScore ?? overallAssessment?.AccuracyScore,
    );
    const words = best?.Words ?? [];

    if (overallScore === null || words.length === 0) {
      this.logger.warn(
        { region, recognitionStatus: result.RecognitionStatus },
        'Azure pronunciation response did not contain assessment scores',
      );
      throw new ServiceUnavailableException(
        'Pronunciation scoring is temporarily unavailable',
      );
    }

    const breakdown: WordBreakdownItem[] = words.map((word, wordIndex) => {
      const wordScore = this.normaliseScore(
        word.PronunciationAssessment?.AccuracyScore,
      );
      const safeWordScore = wordScore ?? 0;
      const errorType = word.PronunciationAssessment?.ErrorType;
      const phonemes: PhonemeScore[] = (word.Phonemes ?? [])
        .map((phoneme) => this.toPhonemeScore(phoneme))
        .filter((phoneme): phoneme is PhonemeScore => phoneme !== null);

      return {
        word: (word.Word || `word ${wordIndex + 1}`).slice(0, 128),
        score: safeWordScore,
        feedback: this.wordFeedback(safeWordScore, errorType),
        phonemes,
      };
    });

    return {
      overall_score: overallScore,
      breakdown,
      feedback_summary: this.summaryFeedback(overallScore),
      detected_language: language,
      transcription: result.DisplayText?.slice(0, 2_000),
    };
  }

  private toPhonemeScore(phoneme: {
    Phoneme?: string;
    PronunciationAssessment?: AzurePhonemeAssessment;
  }): PhonemeScore | null {
    const expected = phoneme.Phoneme?.trim();
    const score = this.normaliseScore(
      phoneme.PronunciationAssessment?.AccuracyScore,
    );
    if (!expected || score === null) return null;

    const bestSpoken = phoneme.PronunciationAssessment?.NBestPhonemes?.find(
      (candidate) => candidate.Phoneme?.trim(),
    )?.Phoneme;

    return {
      phoneme: (bestSpoken?.trim() || expected).slice(0, 32),
      expected_phoneme: expected.slice(0, 32),
      score,
      feedback:
        score >= 85
          ? 'Native-like'
          : score >= 65
            ? 'Acceptable'
            : 'Needs practice',
    };
  }

  private normaliseScore(value: number | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return Math.round(Math.min(100, Math.max(0, value)));
  }

  private summaryFeedback(score: number): string {
    if (score >= 90) return 'Excellent pronunciation!';
    if (score >= 75) return 'Good pronunciation with a few areas to refine.';
    if (score >= 60) return 'Keep practising the highlighted words and sounds.';
    return 'Focus on the highlighted words and sounds, then try again.';
  }

  private wordFeedback(score: number, errorType?: string): string {
    if (errorType && errorType !== 'None') {
      return `Azure assessment: ${errorType}`;
    }
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    return 'Needs work';
  }
}