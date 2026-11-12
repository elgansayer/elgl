import { BadRequestException } from '@nestjs/common';
import {
  VERB_LANGUAGE_CODES,
  VERB_PERSON_KEYS,
  VerbConjugationService,
} from './verb-conjugation.service';

function deterministicRandom(): number {
  return 0;
}

describe('VerbConjugationService', () => {
  let service: VerbConjugationService;

  beforeEach(() => {
    service = new VerbConjugationService();
  });

  it('lists every reviewed verb language with its tenses', () => {
    const languages = service.listLanguages();

    expect(languages.map((language) => language.code)).toEqual([
      ...VERB_LANGUAGE_CODES,
    ]);
    for (const language of languages) {
      expect(language.name.length).toBeGreaterThan(0);
      expect(language.tenses).toEqual(['present', 'past']);
      expect(language.verbCount).toBeGreaterThan(0);
    }
  });

  it('builds a bounded session of distinct exercises', () => {
    const session = service.getSession('es', 'present', 5, deterministicRandom);

    expect(session.languageCode).toBe('es');
    expect(session.languageName).toBe('Spanish');
    expect(session.tense).toBe('present');
    expect(session.exercises).toHaveLength(5);

    const ids = session.exercises.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const exercise of session.exercises) {
      expect(exercise.infinitive.length).toBeGreaterThan(0);
      expect(exercise.translation.length).toBeGreaterThan(0);
      expect(VERB_PERSON_KEYS).toContain(exercise.person);
      expect(exercise.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(exercise.options).size).toBe(exercise.options.length);
    }
  });

  it('includes exactly one correct option in every generated exercise', () => {
    const session = service.getSession('fr', 'past', 20, deterministicRandom);

    for (const exercise of session.exercises) {
      const correctOptions = exercise.options.filter(
        (option) => service.checkAnswer(exercise.id, option).correct,
      );
      expect(correctOptions).toHaveLength(1);
    }
  });

  it('checks answers without leaking the expected form before an attempt', () => {
    const session = service.getSession('it', 'present', 1, deterministicRandom);
    const exercise = session.exercises[0];
    const correctOption = exercise.options.find(
      (option) => service.checkAnswer(exercise.id, option).correct,
    );

    expect(correctOption).toBeDefined();
    expect(
      service.checkAnswer(exercise.id, `  ${correctOption?.toUpperCase()}  `),
    ).toEqual({
      correct: true,
      expected: correctOption,
      submitted: correctOption?.toUpperCase(),
      languageCode: 'it',
    });
    expect(service.checkAnswer(exercise.id, 'definitely-wrong').correct).toBe(
      false,
    );
  });

  it('normalises language codes including regional variants', () => {
    const session = service.getSession(
      'pt-BR',
      undefined,
      1,
      deterministicRandom,
    );

    expect(session.languageCode).toBe('pt');
    expect(session.tense).toBe('present');
  });

  it('defaults an omittted tense to the present tense', () => {
    const session = service.getSession('de', undefined, 2, deterministicRandom);

    expect(session.tense).toBe('present');
  });

  it('rejects unsupported languages and tenses', () => {
    expect(() => service.getSession('en')).toThrow(BadRequestException);
    expect(() => service.getSession('es', 'future')).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed exercise identifiers', () => {
    expect(() => service.checkAnswer('not-an-exercise', 'hablo')).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.checkAnswer('verb:es:hablar:present:9', 'hablo'),
    ).toThrow(BadRequestException);
    expect(() =>
      service.checkAnswer('verb:es:unknown:present:0', 'hablo'),
    ).toThrow(BadRequestException);
  });

  it('rejects blank answers', () => {
    expect(() =>
      service.checkAnswer('verb:es:hablar:present:0', '   '),
    ).toThrow(BadRequestException);
  });

  it('keeps every catalogue entry complete across languages and tenses', () => {
    for (const code of VERB_LANGUAGE_CODES) {
      for (const tense of ['present', 'past'] as const) {
        const session = service.getSession(
          code,
          tense,
          20,
          deterministicRandom,
        );
        expect(session.exercises.length).toBe(20);
        for (const exercise of session.exercises) {
          expect(exercise.options.length).toBeGreaterThanOrEqual(4);
        }
      }
    }
  });
});
