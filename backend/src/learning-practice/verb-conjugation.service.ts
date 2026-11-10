import { BadRequestException, Injectable } from '@nestjs/common';
import type { VerbTense } from './dto/verb-conjugation.dto';
import { VERB_TENSES } from './dto/verb-conjugation.dto';

export const VERB_PERSON_KEYS = [
  'firstSingular',
  'secondSingular',
  'thirdSingular',
  'firstPlural',
  'secondPlural',
  'thirdPlural',
] as const;

export type VerbPersonKey = (typeof VERB_PERSON_KEYS)[number];

export interface VerbLanguageSummary {
  code: string;
  name: string;
  tenses: VerbTense[];
  verbCount: number;
}

export interface VerbExercise {
  id: string;
  languageCode: string;
  infinitive: string;
  translation: string;
  tense: VerbTense;
  person: VerbPersonKey;
  options: string[];
}

export interface VerbSession {
  languageCode: string;
  languageName: string;
  tense: VerbTense;
  exercises: VerbExercise[];
}

export interface VerbAttemptResult {
  correct: boolean;
  expected: string;
  submitted: string;
  languageCode: string;
}

interface VerbEntry {
  id: string;
  infinitive: string;
  translation: string;
  tenses: Record<VerbTense, readonly string[]>;
}

interface VerbLanguageCatalogue {
  name: string;
  verbs: readonly VerbEntry[];
}

const CATALOGUE: Readonly<Record<string, VerbLanguageCatalogue>> = {
  es: {
    name: 'Spanish',
    verbs: [
      {
        id: 'hablar',
        infinitive: 'hablar',
        translation: 'to speak',
        tenses: {
          present: [
            'hablo',
            'hablas',
            'habla',
            'hablamos',
            'habláis',
            'hablan',
          ],
          past: [
            'hablé',
            'hablaste',
            'habló',
            'hablamos',
            'hablasteis',
            'hablaron',
          ],
        },
      },
      {
        id: 'comer',
        infinitive: 'comer',
        translation: 'to eat',
        tenses: {
          present: ['como', 'comes', 'come', 'comemos', 'coméis', 'comen'],
          past: [
            'comí',
            'comiste',
            'comió',
            'comimos',
            'comisteis',
            'comieron',
          ],
        },
      },
      {
        id: 'vivir',
        infinitive: 'vivir',
        translation: 'to live',
        tenses: {
          present: ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven'],
          past: [
            'viví',
            'viviste',
            'vivió',
            'vivimos',
            'vivisteis',
            'vivieron',
          ],
        },
      },
      {
        id: 'tener',
        infinitive: 'tener',
        translation: 'to have',
        tenses: {
          present: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
          past: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'],
        },
      },
      {
        id: 'ir',
        infinitive: 'ir',
        translation: 'to go',
        tenses: {
          present: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
          past: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
        },
      },
    ],
  },
  fr: {
    name: 'French',
    verbs: [
      {
        id: 'parler',
        infinitive: 'parler',
        translation: 'to speak',
        tenses: {
          present: ['parle', 'parles', 'parle', 'parlons', 'parlez', 'parlent'],
          past: [
            'ai parlé',
            'as parlé',
            'a parlé',
            'avons parlé',
            'avez parlé',
            'ont parlé',
          ],
        },
      },
      {
        id: 'etre',
        infinitive: 'être',
        translation: 'to be',
        tenses: {
          present: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'],
          past: [
            'ai été',
            'as été',
            'a été',
            'avons été',
            'avez été',
            'ont été',
          ],
        },
      },
      {
        id: 'avoir',
        infinitive: 'avoir',
        translation: 'to have',
        tenses: {
          present: ['ai', 'as', 'a', 'avons', 'avez', 'ont'],
          past: ['ai eu', 'as eu', 'a eu', 'avons eu', 'avez eu', 'ont eu'],
        },
      },
      {
        id: 'aller',
        infinitive: 'aller',
        translation: 'to go',
        tenses: {
          present: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'],
          past: [
            'suis allé',
            'es allé',
            'est allé',
            'sommes allés',
            'êtes allés',
            'sont allés',
          ],
        },
      },
      {
        id: 'finir',
        infinitive: 'finir',
        translation: 'to finish',
        tenses: {
          present: [
            'finis',
            'finis',
            'finit',
            'finissons',
            'finissez',
            'finissent',
          ],
          past: [
            'ai fini',
            'as fini',
            'a fini',
            'avons fini',
            'avez fini',
            'ont fini',
          ],
        },
      },
    ],
  },
  it: {
    name: 'Italian',
    verbs: [
      {
        id: 'parlare',
        infinitive: 'parlare',
        translation: 'to speak',
        tenses: {
          present: [
            'parlo',
            'parli',
            'parla',
            'parliamo',
            'parlate',
            'parlano',
          ],
          past: [
            'ho parlato',
            'hai parlato',
            'ha parlato',
            'abbiamo parlato',
            'avete parlato',
            'hanno parlato',
          ],
        },
      },
      {
        id: 'essere',
        infinitive: 'essere',
        translation: 'to be',
        tenses: {
          present: ['sono', 'sei', 'è', 'siamo', 'siete', 'sono'],
          past: [
            'sono stato',
            'sei stato',
            'è stato',
            'siamo stati',
            'siete stati',
            'sono stati',
          ],
        },
      },
      {
        id: 'avere',
        infinitive: 'avere',
        translation: 'to have',
        tenses: {
          present: ['ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno'],
          past: [
            'ho avuto',
            'hai avuto',
            'ha avuto',
            'abbiamo avuto',
            'avete avuto',
            'hanno avuto',
          ],
        },
      },
      {
        id: 'andare',
        infinitive: 'andare',
        translation: 'to go',
        tenses: {
          present: ['vado', 'vai', 'va', 'andiamo', 'andate', 'vanno'],
          past: [
            'sono andato',
            'sei andato',
            'è andato',
            'siamo andati',
            'siete andati',
            'sono andati',
          ],
        },
      },
      {
        id: 'finire',
        infinitive: 'finire',
        translation: 'to finish',
        tenses: {
          present: [
            'finisco',
            'finisci',
            'finisce',
            'finiamo',
            'finite',
            'finiscono',
          ],
          past: [
            'ho finito',
            'hai finito',
            'ha finito',
            'abbiamo finito',
            'avete finito',
            'hanno finito',
          ],
        },
      },
    ],
  },
  pt: {
    name: 'Portuguese',
    verbs: [
      {
        id: 'falar',
        infinitive: 'falar',
        translation: 'to speak',
        tenses: {
          present: ['falo', 'falas', 'fala', 'falamos', 'falais', 'falam'],
          past: ['falei', 'falaste', 'falou', 'falámos', 'falastes', 'falaram'],
        },
      },
      {
        id: 'comer',
        infinitive: 'comer',
        translation: 'to eat',
        tenses: {
          present: ['como', 'comes', 'come', 'comemos', 'comeis', 'comem'],
          past: ['comi', 'comeste', 'comeu', 'comemos', 'comestes', 'comeram'],
        },
      },
      {
        id: 'viver',
        infinitive: 'viver',
        translation: 'to live',
        tenses: {
          present: ['vivo', 'vives', 'vive', 'vivemos', 'viveis', 'vivem'],
          past: ['vivi', 'viveste', 'viveu', 'vivemos', 'vivestes', 'viveram'],
        },
      },
      {
        id: 'ser',
        infinitive: 'ser',
        translation: 'to be',
        tenses: {
          present: ['sou', 'és', 'é', 'somos', 'sois', 'são'],
          past: ['fui', 'foste', 'foi', 'fomos', 'fostes', 'foram'],
        },
      },
      {
        id: 'ter',
        infinitive: 'ter',
        translation: 'to have',
        tenses: {
          present: ['tenho', 'tens', 'tem', 'temos', 'tendes', 'têm'],
          past: ['tive', 'tiveste', 'teve', 'tivemos', 'tivestes', 'tiveram'],
        },
      },
    ],
  },
  de: {
    name: 'German',
    verbs: [
      {
        id: 'lernen',
        infinitive: 'lernen',
        translation: 'to learn',
        tenses: {
          present: ['lerne', 'lernst', 'lernt', 'lernen', 'lernt', 'lernen'],
          past: [
            'lernte',
            'lerntest',
            'lernte',
            'lernten',
            'lerntet',
            'lernten',
          ],
        },
      },
      {
        id: 'sein',
        infinitive: 'sein',
        translation: 'to be',
        tenses: {
          present: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
          past: ['war', 'warst', 'war', 'waren', 'wart', 'waren'],
        },
      },
      {
        id: 'haben',
        infinitive: 'haben',
        translation: 'to have',
        tenses: {
          present: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
          past: ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten'],
        },
      },
      {
        id: 'gehen',
        infinitive: 'gehen',
        translation: 'to go',
        tenses: {
          present: ['gehe', 'gehst', 'geht', 'gehen', 'geht', 'gehen'],
          past: ['ging', 'gingst', 'ging', 'gingen', 'gingt', 'gingen'],
        },
      },
      {
        id: 'sprechen',
        infinitive: 'sprechen',
        translation: 'to speak',
        tenses: {
          present: [
            'spreche',
            'sprichst',
            'spricht',
            'sprechen',
            'sprecht',
            'sprechen',
          ],
          past: [
            'sprach',
            'sprachst',
            'sprach',
            'sprachen',
            'spracht',
            'sprachen',
          ],
        },
      },
    ],
  },
};

export const VERB_LANGUAGE_CODES: readonly string[] = Object.keys(CATALOGUE);

const EXERCISE_PREFIX = 'verb';
const OPTION_COUNT = 4;

function normalizeAnswer(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

interface ParsedExerciseId {
  languageCode: string;
  verb: VerbEntry;
  tense: VerbTense;
  personIndex: number;
}

@Injectable()
export class VerbConjugationService {
  listLanguages(): VerbLanguageSummary[] {
    return VERB_LANGUAGE_CODES.map((code) => {
      const language = CATALOGUE[code];
      return {
        code,
        name: language.name,
        tenses: [...VERB_TENSES],
        verbCount: language.verbs.length,
      };
    });
  }

  getSession(
    requestedLanguage = 'es',
    requestedTense?: string,
    limit = 5,
    random: () => number = Math.random,
  ): VerbSession {
    const languageCode = this.normalizeLanguageCode(requestedLanguage);
    const language = CATALOGUE[languageCode];
    if (!language) {
      throw new BadRequestException(
        `Unsupported verb conjugation language. Choose one of: ${VERB_LANGUAGE_CODES.join(', ')}`,
      );
    }

    const tense = this.resolveTense(requestedTense);
    const exercises = shuffle(
      this.buildExercises(languageCode, language, tense),
      random,
    ).slice(
      0,
      Math.min(limit, language.verbs.length * VERB_PERSON_KEYS.length),
    );

    return {
      languageCode,
      languageName: language.name,
      tense,
      exercises,
    };
  }

  checkAnswer(exerciseId: string, submittedAnswer: string): VerbAttemptResult {
    const parsed = this.parseExerciseId(exerciseId);
    const expected = parsed.verb.tenses[parsed.tense][parsed.personIndex];
    const submitted = submittedAnswer.trim();

    if (normalizeAnswer(submitted).length === 0) {
      throw new BadRequestException('An answer is required');
    }

    return {
      correct: normalizeAnswer(submitted) === normalizeAnswer(expected),
      expected,
      submitted,
      languageCode: parsed.languageCode,
    };
  }

  private buildExercises(
    languageCode: string,
    language: VerbLanguageCatalogue,
    tense: VerbTense,
  ): VerbExercise[] {
    const exercises: VerbExercise[] = [];
    for (const verb of language.verbs) {
      for (
        let personIndex = 0;
        personIndex < VERB_PERSON_KEYS.length;
        personIndex += 1
      ) {
        exercises.push({
          id: `${EXERCISE_PREFIX}:${languageCode}:${verb.id}:${tense}:${personIndex}`,
          languageCode,
          infinitive: verb.infinitive,
          translation: verb.translation,
          tense,
          person: VERB_PERSON_KEYS[personIndex],
          options: this.buildOptions(language, verb, tense, personIndex),
        });
      }
    }
    return exercises;
  }

  private buildOptions(
    language: VerbLanguageCatalogue,
    verb: VerbEntry,
    tense: VerbTense,
    personIndex: number,
  ): string[] {
    const correct = verb.tenses[tense][personIndex];
    const candidates = [
      ...verb.tenses[tense].filter((_, index) => index !== personIndex),
      ...language.verbs
        .filter((entry) => entry.id !== verb.id)
        .map((entry) => entry.tenses[tense][personIndex]),
    ];

    const options = [correct];
    const seen = new Set([normalizeAnswer(correct)]);
    for (const candidate of candidates) {
      const key = normalizeAnswer(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(candidate);
      if (options.length === OPTION_COUNT) break;
    }

    return shuffle(options, Math.random);
  }

  private parseExerciseId(exerciseId: string): ParsedExerciseId {
    const parts = exerciseId.split(':');
    if (parts.length !== 5 || parts[0] !== EXERCISE_PREFIX) {
      throw new BadRequestException('Unknown verb conjugation exercise');
    }

    const [, languageCode, verbId, tense, rawPersonIndex] = parts;
    const language = CATALOGUE[languageCode];
    const verb = language?.verbs.find((entry) => entry.id === verbId);
    const personIndex = Number(rawPersonIndex);

    if (
      !language ||
      !verb ||
      !VERB_TENSES.includes(tense as VerbTense) ||
      !Number.isInteger(personIndex) ||
      personIndex < 0 ||
      personIndex >= VERB_PERSON_KEYS.length
    ) {
      throw new BadRequestException('Unknown verb conjugation exercise');
    }

    return {
      languageCode,
      verb,
      tense: tense as VerbTense,
      personIndex,
    };
  }

  private resolveTense(requestedTense?: string): VerbTense {
    if (!requestedTense) return 'present';
    if (!VERB_TENSES.includes(requestedTense as VerbTense)) {
      throw new BadRequestException(
        `Unsupported tense. Choose one of: ${VERB_TENSES.join(', ')}`,
      );
    }
    return requestedTense as VerbTense;
  }

  private normalizeLanguageCode(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase().replace('_', '-').split('-')[0];
  }
}
