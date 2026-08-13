import { Injectable, inject } from '@angular/core';
import { VocabularyStore } from './vocabulary.store';

export interface VocabularyChallenge {
  word: string;
  challenge: string;
}

@Injectable({
  providedIn: 'root'
})
export class SocialLearningService {
  private vocabStore = inject(VocabularyStore);

  async generateQuestions(_articleContent: string): Promise<string[]> {
    return [
      "What was the main theme of this article?",
      "How does the author support their main argument?",
      "What is your personal opinion on this topic?"
    ];
  }

  async generateVocabularyChallenges(): Promise<VocabularyChallenge[]> {
    const flashcards = this.vocabStore.allFlashcards();

    if (flashcards.length === 0) {
      return [
        { word: "Example", challenge: "Use 'Example' in a sentence about your day." }
      ];
    }

    const selectedCards = [...flashcards].sort(() => 0.5 - Math.random()).slice(0, 3);

    return selectedCards.map(card => ({
      word: card.word_token,
      challenge: `Try using "${card.word_token}" in a sentence explaining the article.`
    }));
  }

  async generateConversationStarters(): Promise<string[]> {
    return [
      "Did you find the article interesting?",
      "I didn't understand the part about...",
      "This reminded me of..."
    ];
  }
}
