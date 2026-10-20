import { Injectable } from '@nestjs/common';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  example: string;
}

@Injectable()
export class WordOfTheDayService {
  getTodayWord(): WordOfTheDay {
    // Mock data – replace with real source once available
    return {
      word: 'Hola',
      translation: 'Hello',
      language: 'Spanish',
      example: '¡Hola! ¿Cómo estás?',
    };
  }
}
