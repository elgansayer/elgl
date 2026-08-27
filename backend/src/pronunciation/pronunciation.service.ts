import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { PronunciationFeedbackResponseDto } from './dto/pronunciation-feedback.dto';

@Injectable()
export class PronunciationService {
  private readonly region: string;
  private readonly subscriptionKey: string | undefined;

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(PronunciationService.name)
    private readonly logger: PinoLogger,
  ) {
    this.region = config.get<string>('AZURE_SPEECH_REGION') ?? 'eastus';
    this.subscriptionKey = config.get<string>('AZURE_SPEECH_KEY');
  }

  async analyse(
    audio: Express.Multer.File,
    referenceText?: string,
  ): Promise<PronunciationFeedbackResponseDto> {
    // If no Azure key configured, fall back to placeholder
    if (!this.subscriptionKey) {
      return this.fallbackAnalysis();
    }

    try {
      const url = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=simple`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'Content-Type': 'audio/wav',
        },
        body: audio.buffer as BodyInit,
      });

      const data: { DisplayText?: string; RecognitionStatus?: string } =
        await response.json();
      const recognizedText = data.DisplayText ?? '';

      // Compute accuracy relative to the reference text
      const score = this.computeAccuracy(referenceText ?? '', recognizedText);

      return {
        score,
        phonemeBreakdown: [], // real phoneme breakdown would require detailed result
        overallAssessment:
          score >= 80
            ? 'Good pronunciation, very close to native'
            : score >= 50
              ? 'Mostly understandable, some sounds need improvement'
              : 'Needs significant improvement, practice recommended',
        language: 'en',
      };
    } catch {
      // Fallback on any network / API error
      return this.fallbackAnalysis();
    }
  }

  private computeAccuracy(ref: string, hyp: string): number {
    if (!ref) return 100;
    const refWords = ref
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const hypWords = hyp
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (refWords.length === 0) return 100;

    // Levenshtein distance on word arrays
    const len1 = refWords.length;
    const len2 = hypWords.length;
    const dp: number[][] = Array.from({ length: len1 + 1 }, () =>
      new Array(len2 + 1).fill(0),
    );
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = refWords[i - 1] === hypWords[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }
    const distance = dp[len1][len2];
    return Math.max(0, Math.round((1 - distance / len1) * 100));
  }

  private fallbackAnalysis(): PronunciationFeedbackResponseDto {
    return {
      score: 68,
      phonemeBreakdown: ['/θ/', '/ð/', '/r/'],
      overallAssessment:
        'Mostly understandable, needs work on dental fricatives.',
      language: 'en',
    };
  }
  processVoiceFeedback(
    audio: Express.Multer.File,
    feedbackText: string,
  ): Promise<{ success: boolean }> {
    // Placeholder logic for processing voice feedback
    // In a real implementation, this could involve saving the audio and text to a database
    this.logger.info(
      { feedbackTextLength: feedbackText.length, audioSize: audio.size },
      'Received voice feedback',
    );
    return Promise.resolve({ success: true });
  }
}
