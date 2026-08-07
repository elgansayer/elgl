import { Test, TestingModule } from '@nestjs/testing';
import { WordOfTheDayService } from './word-of-the-day.service';

describe('WordOfTheDayService', () => {
  let service: WordOfTheDayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WordOfTheDayService],
    }).compile();

    service = module.get<WordOfTheDayService>(WordOfTheDayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTodayWord', () => {
    it('returns a word with the expected shape', () => {
      const word = service.getTodayWord();

      expect(word).toBeDefined();
      expect(typeof word.word).toBe('string');
      expect(word.word.length).toBeGreaterThan(0);
      expect(typeof word.translation).toBe('string');
      expect(word.translation.length).toBeGreaterThan(0);
      expect(typeof word.language).toBe('string');
      expect(word.language.length).toBeGreaterThan(0);
      expect(typeof word.example).toBe('string');
      expect(word.example.length).toBeGreaterThan(0);
    });

    it('returns the same word for the same day', () => {
      const first = service.getTodayWord();
      const second = service.getTodayWord();

      expect(first.word).toBe(second.word);
      expect(first.language).toBe(second.language);
    });

    it('returns a word from the word pool', () => {
      const word = service.getTodayWord();

      expect(word).toBeDefined();
      // Word should be non-empty and from a valid language
      const knownLanguages = [
        'Spanish',
        'French',
        'Italian',
        'German',
        'Japanese',
        'Korean',
        'Portuguese',
        'Arabic',
        'Mandarin Chinese',
        'Russian',
        'Dutch',
        'Swedish',
        'Hindi',
        'Thai',
      ];
      expect(knownLanguages).toContain(word.language);
    });
  });
});
