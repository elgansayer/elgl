import { Injectable } from '@nestjs/common';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  languageCode: string;
  example: string;
  date: string;
}

type CuratedWord = Omit<WordOfTheDay, 'date'>;

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Small, reviewed starter catalogue used by the public Word of the Day feed.
 *
 * Keeping the catalogue in source makes the feature deterministic and
 * available without a third-party vocabulary provider. Entries are product
 * content, not runtime fallback data: the API rotates them by UTC date and
 * never fabricates a replacement response when execution fails.
 */
const WORD_CATALOGUE: readonly CuratedWord[] = [
  {
    word: 'hola',
    translation: 'hello',
    language: 'Spanish',
    languageCode: 'es',
    example: 'Hola, ¿cómo estás?',
  },
  {
    word: 'gracias',
    translation: 'thank you',
    language: 'Spanish',
    languageCode: 'es',
    example: 'Muchas gracias por tu ayuda.',
  },
  {
    word: 'bonjour',
    translation: 'hello',
    language: 'French',
    languageCode: 'fr',
    example: 'Bonjour, comment allez-vous ?',
  },
  {
    word: 'ensemble',
    translation: 'together',
    language: 'French',
    languageCode: 'fr',
    example: 'Nous apprenons ensemble.',
  },
  {
    word: 'こんにちは',
    translation: 'hello',
    language: 'Japanese',
    languageCode: 'ja',
    example: 'こんにちは。お元気ですか。',
  },
  {
    word: 'ありがとう',
    translation: 'thank you',
    language: 'Japanese',
    languageCode: 'ja',
    example: '手伝ってくれて、ありがとう。',
  },
  {
    word: '안녕하세요',
    translation: 'hello',
    language: 'Korean',
    languageCode: 'ko',
    example: '안녕하세요. 만나서 반가워요.',
  },
  {
    word: '함께',
    translation: 'together',
    language: 'Korean',
    languageCode: 'ko',
    example: '우리 함께 공부해요.',
  },
  {
    word: 'hallo',
    translation: 'hello',
    language: 'German',
    languageCode: 'de',
    example: 'Hallo! Wie geht es dir?',
  },
  {
    word: 'lernen',
    translation: 'to learn',
    language: 'German',
    languageCode: 'de',
    example: 'Ich lerne jeden Tag Deutsch.',
  },
  {
    word: 'ciao',
    translation: 'hello',
    language: 'Italian',
    languageCode: 'it',
    example: 'Ciao, piacere di conoscerti.',
  },
  {
    word: 'insieme',
    translation: 'together',
    language: 'Italian',
    languageCode: 'it',
    example: 'Studiamo insieme.',
  },
  {
    word: 'olá',
    translation: 'hello',
    language: 'Portuguese',
    languageCode: 'pt',
    example: 'Olá! Tudo bem?',
  },
  {
    word: 'aprender',
    translation: 'to learn',
    language: 'Portuguese',
    languageCode: 'pt',
    example: 'Quero aprender português.',
  },
  {
    word: '你好',
    translation: 'hello',
    language: 'Mandarin Chinese',
    languageCode: 'zh',
    example: '你好，很高兴认识你。',
  },
  {
    word: '一起',
    translation: 'together',
    language: 'Mandarin Chinese',
    languageCode: 'zh',
    example: '我们一起学习吧。',
  },
] as const;

@Injectable()
export class WordOfTheDayService {
  getTodayWord(now: Date = new Date()): WordOfTheDay {
    if (Number.isNaN(now.getTime())) {
      throw new TypeError('Word of the Day requires a valid date');
    }

    const utcDate = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const dayNumber = Math.floor(utcDate / MILLISECONDS_PER_DAY);
    const index = ((dayNumber % WORD_CATALOGUE.length) + WORD_CATALOGUE.length) % WORD_CATALOGUE.length;
    const entry = WORD_CATALOGUE[index];

    return {
      ...entry,
      date: now.toISOString().slice(0, 10),
    };
  }
}
