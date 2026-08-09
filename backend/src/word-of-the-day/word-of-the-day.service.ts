import { Injectable } from '@nestjs/common';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  example: string;
}

const WORD_POOL: WordOfTheDay[] = [
  {
    word: 'Hola',
    translation: 'Hello',
    language: 'Spanish',
    example: '¡Hola! ¿Cómo estás?',
  },
  {
    word: 'Merci',
    translation: 'Thank you',
    language: 'French',
    example: 'Merci beaucoup pour votre aide.',
  },
  {
    word: 'Ciao',
    translation: 'Hello / Goodbye',
    language: 'Italian',
    example: 'Ciao, come stai?',
  },
  {
    word: 'Guten Tag',
    translation: 'Good day',
    language: 'German',
    example: 'Guten Tag, wie geht es Ihnen?',
  },
  {
    word: 'Arigatō',
    translation: 'Thank you',
    language: 'Japanese',
    example: 'Arigatō gozaimasu, sensei.',
  },
  {
    word: 'Annyeong',
    translation: 'Hello',
    language: 'Korean',
    example: 'Annyeong haseyo, bangawoyo.',
  },
  {
    word: 'Obrigado',
    translation: 'Thank you',
    language: 'Portuguese',
    example: 'Muito obrigado pela sua ajuda.',
  },
  {
    word: 'Salaam',
    translation: 'Peace / Hello',
    language: 'Arabic',
    example: 'As-salaam alaykum wa rahmatullah.',
  },
  {
    word: 'Xiexie',
    translation: 'Thank you',
    language: 'Mandarin Chinese',
    example: 'Xiexie ni de bangzhu.',
  },
  {
    word: 'Spasibo',
    translation: 'Thank you',
    language: 'Russian',
    example: 'Bolshoe spasibo za pomoshch.',
  },
  {
    word: 'Dank je',
    translation: 'Thank you',
    language: 'Dutch',
    example: 'Dank je wel voor je hulp.',
  },
  {
    word: 'Hej',
    translation: 'Hello',
    language: 'Swedish',
    example: 'Hej, hur mår du?',
  },
  {
    word: 'Namaste',
    translation: 'Hello / I bow to you',
    language: 'Hindi',
    example: 'Namaste, aap kaise hain?',
  },
  {
    word: 'Kop khun',
    translation: 'Thank you',
    language: 'Thai',
    example: 'Kop khun khrap/kha mak mak.',
  },
];

@Injectable()
export class WordOfTheDayService {
  getTodayWord(): WordOfTheDay {
    const today = new Date();
    const dayOfYear = this.getDayOfYear(today);
    const year = today.getFullYear();
    const seed = dayOfYear * 31 + year * 7;
    const index = seed % WORD_POOL.length;
    return WORD_POOL[index];
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
