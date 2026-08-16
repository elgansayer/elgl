import { Injectable, Logger } from '@nestjs/common';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { NlpService } from './nlp.service';

@Injectable()
export class NlpWorkerService {
  private readonly logger = new Logger(NlpWorkerService.name);

  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly nlpService: NlpService,
  ) {}

  /**
   * Background task to automatically extract vocabulary from a transcript
   * and queue flashcards for the user to review.
   */
  async processSessionTranscript(userId: string, transcript: string): Promise<void> {
    if (!transcript || transcript.trim().length === 0) return;

    try {
      this.logger.log(`Extracting vocabulary for user ${userId}...`);
      const { vocabulary } = await this.nlpService.generateSessionSummary(transcript);

      for (const word of vocabulary) {
        try {
          await this.flashcardsService.createFlashcard(userId, {
            word_token: word,
            translation: 'Auto-extracted from conversation',
          });
        } catch (err) {
          this.logger.warn(`Failed to create flashcard for word "${word}": ${(err as Error).message}`);
        }
      }
      this.logger.log(`Successfully extracted and created ${vocabulary.length} flashcards for user ${userId}.`);
    } catch (err) {
      this.logger.error(`Failed to process session transcript for user ${userId}`, (err as Error).stack);
    }
  }
}
