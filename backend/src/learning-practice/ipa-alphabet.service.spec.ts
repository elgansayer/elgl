import { BadRequestException } from '@nestjs/common';
import { IPA_LANGUAGE_CODES, IpaAlphabetService } from './ipa-alphabet.service';

function deterministicRandom(): number {
  return 0;
}

describe('IpaAlphabetService', () => {
  let service: IpaAlphabetService;

  beforeEach(() => {
    service = new IpaAlphabetService();
  });

  it('lists the reviewed IPA languages and phoneme counts', () => {
    const languages = service.listLanguages();

    expect(languages.map((language) => language.code)).toEqual([
      ...IPA_LANGUAGE_CODES,
    ]);
    expect(
      languages.find((language) => language.code === 'en')?.phonemeCount,
    ).toBe(44);
    expect(
      languages.find((language) => language.code === 'es')?.phonemeCount,
    ).toBe(24);
    expect(
      languages.find((language) => language.code === 'fr')?.phonemeCount,
    ).toBe(35);
  });

  it('returns the full English phoneme inventory', () => {
    const catalogue = service.getCatalogue('en');

    expect(catalogue.languageName).toBe('English');
    expect(catalogue.phonemes).toHaveLength(44);
    expect(
      catalogue.phonemes.filter((entry) => entry.type === 'vowel'),
    ).toHaveLength(12);
    expect(
      catalogue.phonemes.filter((entry) => entry.type === 'diphthong'),
    ).toHaveLength(8);
    expect(
      catalogue.phonemes.filter((entry) => entry.type === 'consonant'),
    ).toHaveLength(24);
  });

  it('keeps phoneme identifiers and example words unique per language', () => {
    for (const code of IPA_LANGUAGE_CODES) {
      const { phonemes } = service.getCatalogue(code);
      const ids = phonemes.map((entry) => entry.id);
      const examples = phonemes.map((entry) => entry.example);

      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(examples).size).toBe(examples.length);
      for (const phoneme of phonemes) {
        expect(phoneme.symbol.length).toBeGreaterThan(0);
        expect(phoneme.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('builds a bounded quiz of distinct questions', () => {
    const quiz = service.getQuiz('fr', 5, deterministicRandom);

    expect(quiz.languageCode).toBe('fr');
    expect(quiz.questions).toHaveLength(5);
    const ids = quiz.questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const question of quiz.questions) {
      expect(question.options.length).toBeGreaterThanOrEqual(4);
      expect(new Set(question.options).size).toBe(question.options.length);
    }
  });

  it('includes exactly one correct example word per question', () => {
    const quiz = service.getQuiz('es', 20, deterministicRandom);

    for (const question of quiz.questions) {
      const correctOptions = question.options.filter(
        (option) => service.checkAnswer(question.id, option).correct,
      );
      expect(correctOptions).toHaveLength(1);
    }
  });

  it('checks answers case and whitespace insensitively', () => {
    const quiz = service.getQuiz('en', 1, deterministicRandom);
    const question = quiz.questions[0];
    const correctOption = question.options.find(
      (option) => service.checkAnswer(question.id, option).correct,
    );

    expect(correctOption).toBeDefined();
    expect(
      service.checkAnswer(question.id, `  ${correctOption?.toUpperCase()}  `),
    ).toEqual({
      correct: true,
      expected: correctOption,
      submitted: correctOption?.toUpperCase(),
      languageCode: 'en',
    });
    expect(service.checkAnswer(question.id, 'definitely-wrong').correct).toBe(
      false,
    );
  });

  it('normalises regional language codes', () => {
    expect(service.getCatalogue('en-GB').languageCode).toBe('en');
  });

  it('rejects unsupported languages and malformed identifiers', () => {
    expect(() => service.getCatalogue('ja')).toThrow(BadRequestException);
    expect(() => service.getQuiz('ja')).toThrow(BadRequestException);
    expect(() => service.checkAnswer('nonsense', 'see')).toThrow(
      BadRequestException,
    );
    expect(() => service.checkAnswer('ipa:en:unknown', 'see')).toThrow(
      BadRequestException,
    );
  });

  it('rejects blank answers', () => {
    const quiz = service.getQuiz('en', 1, deterministicRandom);
    expect(() => service.checkAnswer(quiz.questions[0].id, '   ')).toThrow(
      BadRequestException,
    );
  });
});
