import { BadRequestException, Injectable } from '@nestjs/common';

export type IpaPhonemeType = 'vowel' | 'diphthong' | 'consonant' | 'nasal';

export interface IpaPhoneme {
  id: string;
  symbol: string;
  type: IpaPhonemeType;
  example: string;
  description: string;
}

export interface IpaLanguageSummary {
  code: string;
  name: string;
  phonemeCount: number;
}

export interface IpaCatalogue {
  languageCode: string;
  languageName: string;
  phonemes: IpaPhoneme[];
}

export interface IpaQuizQuestion {
  id: string;
  symbol: string;
  type: IpaPhonemeType;
  description: string;
  options: string[];
}

export interface IpaQuiz {
  languageCode: string;
  languageName: string;
  questions: IpaQuizQuestion[];
}

export interface IpaAttemptResult {
  correct: boolean;
  expected: string;
  submitted: string;
  languageCode: string;
}

interface IpaLanguageCatalogue {
  name: string;
  phonemes: readonly IpaPhoneme[];
}

const ENGLISH_PHONEMES: readonly IpaPhoneme[] = [
  {
    id: 'i-long',
    symbol: '/iː/',
    type: 'vowel',
    example: 'see',
    description: 'Close front unrounded vowel, as in see',
  },
  {
    id: 'i-short',
    symbol: '/ɪ/',
    type: 'vowel',
    example: 'sit',
    description: 'Near-close near-front unrounded vowel, as in sit',
  },
  {
    id: 'e',
    symbol: '/e/',
    type: 'vowel',
    example: 'bed',
    description: 'Close-mid front unrounded vowel, as in bed',
  },
  {
    id: 'ash',
    symbol: '/æ/',
    type: 'vowel',
    example: 'cat',
    description: 'Near-open front unrounded vowel, as in cat',
  },
  {
    id: 'a-long',
    symbol: '/ɑː/',
    type: 'vowel',
    example: 'car',
    description: 'Open back unrounded vowel, as in car',
  },
  {
    id: 'o-short',
    symbol: '/ɒ/',
    type: 'vowel',
    example: 'hot',
    description: 'Open back rounded vowel, as in hot',
  },
  {
    id: 'o-long',
    symbol: '/ɔː/',
    type: 'vowel',
    example: 'law',
    description: 'Open-mid back rounded vowel, as in law',
  },
  {
    id: 'u-short',
    symbol: '/ʊ/',
    type: 'vowel',
    example: 'book',
    description: 'Near-close near-back rounded vowel, as in book',
  },
  {
    id: 'u-long',
    symbol: '/uː/',
    type: 'vowel',
    example: 'food',
    description: 'Close back rounded vowel, as in food',
  },
  {
    id: 'wedge',
    symbol: '/ʌ/',
    type: 'vowel',
    example: 'cup',
    description: 'Open-mid back unrounded vowel, as in cup',
  },
  {
    id: 'er',
    symbol: '/ɜː/',
    type: 'vowel',
    example: 'bird',
    description: 'Open-mid central unrounded vowel, as in bird',
  },
  {
    id: 'schwa',
    symbol: '/ə/',
    type: 'vowel',
    example: 'about',
    description: 'Mid central vowel, the unstressed schwa in about',
  },
  {
    id: 'face',
    symbol: '/eɪ/',
    type: 'diphthong',
    example: 'day',
    description: 'Closing diphthong, as in day',
  },
  {
    id: 'price',
    symbol: '/aɪ/',
    type: 'diphthong',
    example: 'my',
    description: 'Closing diphthong, as in my',
  },
  {
    id: 'choice',
    symbol: '/ɔɪ/',
    type: 'diphthong',
    example: 'boy',
    description: 'Closing diphthong, as in boy',
  },
  {
    id: 'mouth',
    symbol: '/aʊ/',
    type: 'diphthong',
    example: 'now',
    description: 'Closing diphthong, as in now',
  },
  {
    id: 'goat',
    symbol: '/əʊ/',
    type: 'diphthong',
    example: 'go',
    description: 'Closing diphthong, as in go',
  },
  {
    id: 'near',
    symbol: '/ɪə/',
    type: 'diphthong',
    example: 'near',
    description: 'Centring diphthong, as in near',
  },
  {
    id: 'square',
    symbol: '/eə/',
    type: 'diphthong',
    example: 'hair',
    description: 'Centring diphthong, as in hair',
  },
  {
    id: 'cure',
    symbol: '/ʊə/',
    type: 'diphthong',
    example: 'tour',
    description: 'Centring diphthong, as in tour',
  },
  {
    id: 'p',
    symbol: '/p/',
    type: 'consonant',
    example: 'pen',
    description: 'Voiceless bilabial plosive, as in pen',
  },
  {
    id: 'b',
    symbol: '/b/',
    type: 'consonant',
    example: 'bad',
    description: 'Voiced bilabial plosive, as in bad',
  },
  {
    id: 't',
    symbol: '/t/',
    type: 'consonant',
    example: 'tea',
    description: 'Voiceless alveolar plosive, as in tea',
  },
  {
    id: 'd',
    symbol: '/d/',
    type: 'consonant',
    example: 'did',
    description: 'Voiced alveolar plosive, as in did',
  },
  {
    id: 'k',
    symbol: '/k/',
    type: 'consonant',
    example: 'key',
    description: 'Voiceless velar plosive, as in key',
  },
  {
    id: 'g',
    symbol: '/g/',
    type: 'consonant',
    example: 'gap',
    description: 'Voiced velar plosive, as in gap',
  },
  {
    id: 'ch',
    symbol: '/tʃ/',
    type: 'consonant',
    example: 'chair',
    description: 'Voiceless postalveolar affricate, as in chair',
  },
  {
    id: 'j',
    symbol: '/dʒ/',
    type: 'consonant',
    example: 'job',
    description: 'Voiced postalveolar affricate, as in job',
  },
  {
    id: 'f',
    symbol: '/f/',
    type: 'consonant',
    example: 'fall',
    description: 'Voiceless labiodental fricative, as in fall',
  },
  {
    id: 'v',
    symbol: '/v/',
    type: 'consonant',
    example: 'van',
    description: 'Voiced labiodental fricative, as in van',
  },
  {
    id: 'theta',
    symbol: '/θ/',
    type: 'consonant',
    example: 'think',
    description: 'Voiceless dental fricative, as in think',
  },
  {
    id: 'eth',
    symbol: '/ð/',
    type: 'consonant',
    example: 'this',
    description: 'Voiced dental fricative, as in this',
  },
  {
    id: 's',
    symbol: '/s/',
    type: 'consonant',
    example: 'sun',
    description: 'Voiceless alveolar fricative, as in sun',
  },
  {
    id: 'z',
    symbol: '/z/',
    type: 'consonant',
    example: 'zoo',
    description: 'Voiced alveolar fricative, as in zoo',
  },
  {
    id: 'esh',
    symbol: '/ʃ/',
    type: 'consonant',
    example: 'she',
    description: 'Voiceless postalveolar fricative, as in she',
  },
  {
    id: 'ezh',
    symbol: '/ʒ/',
    type: 'consonant',
    example: 'vision',
    description: 'Voiced postalveolar fricative, as in vision',
  },
  {
    id: 'h',
    symbol: '/h/',
    type: 'consonant',
    example: 'how',
    description: 'Voiceless glottal fricative, as in how',
  },
  {
    id: 'm',
    symbol: '/m/',
    type: 'consonant',
    example: 'man',
    description: 'Voiced bilabial nasal, as in man',
  },
  {
    id: 'n',
    symbol: '/n/',
    type: 'consonant',
    example: 'no',
    description: 'Voiced alveolar nasal, as in no',
  },
  {
    id: 'ng',
    symbol: '/ŋ/',
    type: 'consonant',
    example: 'sing',
    description: 'Voiced velar nasal, as in sing',
  },
  {
    id: 'l',
    symbol: '/l/',
    type: 'consonant',
    example: 'leg',
    description: 'Voiced alveolar lateral approximant, as in leg',
  },
  {
    id: 'r',
    symbol: '/r/',
    type: 'consonant',
    example: 'red',
    description: 'Voiced postalveolar approximant, as in red',
  },
  {
    id: 'y',
    symbol: '/j/',
    type: 'consonant',
    example: 'yes',
    description: 'Voiced palatal approximant, as in yes',
  },
  {
    id: 'w',
    symbol: '/w/',
    type: 'consonant',
    example: 'wet',
    description: 'Voiced labial-velar approximant, as in wet',
  },
];

const SPANISH_PHONEMES: readonly IpaPhoneme[] = [
  {
    id: 'a',
    symbol: '/a/',
    type: 'vowel',
    example: 'casa',
    description: 'Open central unrounded vowel, as in casa',
  },
  {
    id: 'e',
    symbol: '/e/',
    type: 'vowel',
    example: 'mesa',
    description: 'Close-mid front unrounded vowel, as in mesa',
  },
  {
    id: 'i',
    symbol: '/i/',
    type: 'vowel',
    example: 'sí',
    description: 'Close front unrounded vowel, as in sí',
  },
  {
    id: 'o',
    symbol: '/o/',
    type: 'vowel',
    example: 'sol',
    description: 'Close-mid back rounded vowel, as in sol',
  },
  {
    id: 'u',
    symbol: '/u/',
    type: 'vowel',
    example: 'luna',
    description: 'Close back rounded vowel, as in luna',
  },
  {
    id: 'p',
    symbol: '/p/',
    type: 'consonant',
    example: 'pan',
    description: 'Voiceless bilabial plosive, as in pan',
  },
  {
    id: 'b',
    symbol: '/b/',
    type: 'consonant',
    example: 'beso',
    description: 'Voiced bilabial plosive, as in beso',
  },
  {
    id: 't',
    symbol: '/t/',
    type: 'consonant',
    example: 'té',
    description: 'Voiceless dental plosive, as in té',
  },
  {
    id: 'd',
    symbol: '/d/',
    type: 'consonant',
    example: 'dedo',
    description: 'Voiced dental plosive, as in dedo',
  },
  {
    id: 'k',
    symbol: '/k/',
    type: 'consonant',
    example: 'queso',
    description: 'Voiceless velar plosive, as in queso',
  },
  {
    id: 'g',
    symbol: '/g/',
    type: 'consonant',
    example: 'gato',
    description: 'Voiced velar plosive, as in gato',
  },
  {
    id: 'f',
    symbol: '/f/',
    type: 'consonant',
    example: 'feliz',
    description: 'Voiceless labiodental fricative, as in feliz',
  },
  {
    id: 'theta',
    symbol: '/θ/',
    type: 'consonant',
    example: 'cinco',
    description: 'Voiceless dental fricative, as in cinco',
  },
  {
    id: 's',
    symbol: '/s/',
    type: 'consonant',
    example: 'silla',
    description: 'Voiceless alveolar fricative, as in silla',
  },
  {
    id: 'jota',
    symbol: '/x/',
    type: 'consonant',
    example: 'jamón',
    description: 'Voiceless velar fricative, as in jamón',
  },
  {
    id: 'ch',
    symbol: '/tʃ/',
    type: 'consonant',
    example: 'chico',
    description: 'Voiceless postalveolar affricate, as in chico',
  },
  {
    id: 'y',
    symbol: '/ʝ/',
    type: 'consonant',
    example: 'yeso',
    description: 'Voiced palatal fricative, as in yeso',
  },
  {
    id: 'm',
    symbol: '/m/',
    type: 'consonant',
    example: 'mano',
    description: 'Voiced bilabial nasal, as in mano',
  },
  {
    id: 'n',
    symbol: '/n/',
    type: 'consonant',
    example: 'no',
    description: 'Voiced alveolar nasal, as in no',
  },
  {
    id: 'enye',
    symbol: '/ɲ/',
    type: 'consonant',
    example: 'niño',
    description: 'Voiced palatal nasal, as in niño',
  },
  {
    id: 'l',
    symbol: '/l/',
    type: 'consonant',
    example: 'lápiz',
    description: 'Voiced alveolar lateral approximant, as in lápiz',
  },
  {
    id: 'ellye',
    symbol: '/ʎ/',
    type: 'consonant',
    example: 'llave',
    description: 'Voiced palatal lateral approximant, as in llave',
  },
  {
    id: 'tap',
    symbol: '/ɾ/',
    type: 'consonant',
    example: 'pero',
    description: 'Voiced alveolar tap, as in pero',
  },
  {
    id: 'trill',
    symbol: '/r/',
    type: 'consonant',
    example: 'perro',
    description: 'Voiced alveolar trill, as in perro',
  },
];

const FRENCH_PHONEMES: readonly IpaPhoneme[] = [
  {
    id: 'a',
    symbol: '/a/',
    type: 'vowel',
    example: 'patte',
    description: 'Open front unrounded vowel, as in patte',
  },
  {
    id: 'e',
    symbol: '/e/',
    type: 'vowel',
    example: 'été',
    description: 'Close-mid front unrounded vowel, as in été',
  },
  {
    id: 'epsilon',
    symbol: '/ɛ/',
    type: 'vowel',
    example: 'père',
    description: 'Open-mid front unrounded vowel, as in père',
  },
  {
    id: 'i',
    symbol: '/i/',
    type: 'vowel',
    example: 'si',
    description: 'Close front unrounded vowel, as in si',
  },
  {
    id: 'o',
    symbol: '/o/',
    type: 'vowel',
    example: 'beau',
    description: 'Close-mid back rounded vowel, as in beau',
  },
  {
    id: 'open-o',
    symbol: '/ɔ/',
    type: 'vowel',
    example: 'sort',
    description: 'Open-mid back rounded vowel, as in sort',
  },
  {
    id: 'u',
    symbol: '/u/',
    type: 'vowel',
    example: 'tout',
    description: 'Close back rounded vowel, as in tout',
  },
  {
    id: 'u-rounded',
    symbol: '/y/',
    type: 'vowel',
    example: 'tu',
    description: 'Close front rounded vowel, as in tu',
  },
  {
    id: 'oe',
    symbol: '/ø/',
    type: 'vowel',
    example: 'peu',
    description: 'Close-mid front rounded vowel, as in peu',
  },
  {
    id: 'oe-open',
    symbol: '/œ/',
    type: 'vowel',
    example: 'sœur',
    description: 'Open-mid front rounded vowel, as in sœur',
  },
  {
    id: 'schwa',
    symbol: '/ə/',
    type: 'vowel',
    example: 'le',
    description: 'Mid central vowel, as in le',
  },
  {
    id: 'an',
    symbol: '/ɑ̃/',
    type: 'nasal',
    example: 'sans',
    description: 'Open nasal vowel, as in sans',
  },
  {
    id: 'in',
    symbol: '/ɛ̃/',
    type: 'nasal',
    example: 'pain',
    description: 'Open-mid front nasal vowel, as in pain',
  },
  {
    id: 'on',
    symbol: '/ɔ̃/',
    type: 'nasal',
    example: 'bon',
    description: 'Open-mid back nasal vowel, as in bon',
  },
  {
    id: 'un',
    symbol: '/œ̃/',
    type: 'nasal',
    example: 'brun',
    description: 'Open-mid front rounded nasal vowel, as in brun',
  },
  {
    id: 'p',
    symbol: '/p/',
    type: 'consonant',
    example: 'porte',
    description: 'Voiceless bilabial plosive, as in porte',
  },
  {
    id: 'b',
    symbol: '/b/',
    type: 'consonant',
    example: 'balle',
    description: 'Voiced bilabial plosive, as in balle',
  },
  {
    id: 't',
    symbol: '/t/',
    type: 'consonant',
    example: 'table',
    description: 'Voiceless dental plosive, as in table',
  },
  {
    id: 'd',
    symbol: '/d/',
    type: 'consonant',
    example: 'dos',
    description: 'Voiced dental plosive, as in dos',
  },
  {
    id: 'k',
    symbol: '/k/',
    type: 'consonant',
    example: 'qui',
    description: 'Voiceless velar plosive, as in qui',
  },
  {
    id: 'g',
    symbol: '/g/',
    type: 'consonant',
    example: 'gare',
    description: 'Voiced velar plosive, as in gare',
  },
  {
    id: 'f',
    symbol: '/f/',
    type: 'consonant',
    example: 'foi',
    description: 'Voiceless labiodental fricative, as in foi',
  },
  {
    id: 'v',
    symbol: '/v/',
    type: 'consonant',
    example: 'vous',
    description: 'Voiced labiodental fricative, as in vous',
  },
  {
    id: 's',
    symbol: '/s/',
    type: 'consonant',
    example: 'sel',
    description: 'Voiceless alveolar fricative, as in sel',
  },
  {
    id: 'z',
    symbol: '/z/',
    type: 'consonant',
    example: 'zéro',
    description: 'Voiced alveolar fricative, as in zéro',
  },
  {
    id: 'esh',
    symbol: '/ʃ/',
    type: 'consonant',
    example: 'chat',
    description: 'Voiceless postalveolar fricative, as in chat',
  },
  {
    id: 'ezh',
    symbol: '/ʒ/',
    type: 'consonant',
    example: 'jour',
    description: 'Voiced postalveolar fricative, as in jour',
  },
  {
    id: 'm',
    symbol: '/m/',
    type: 'consonant',
    example: 'main',
    description: 'Voiced bilabial nasal, as in main',
  },
  {
    id: 'n',
    symbol: '/n/',
    type: 'consonant',
    example: 'non',
    description: 'Voiced alveolar nasal, as in non',
  },
  {
    id: 'enye',
    symbol: '/ɲ/',
    type: 'consonant',
    example: 'agneau',
    description: 'Voiced palatal nasal, as in agneau',
  },
  {
    id: 'l',
    symbol: '/l/',
    type: 'consonant',
    example: 'lit',
    description: 'Voiced alveolar lateral approximant, as in lit',
  },
  {
    id: 'r',
    symbol: '/ʁ/',
    type: 'consonant',
    example: 'rue',
    description: 'Voiced uvular fricative, as in rue',
  },
  {
    id: 'yod',
    symbol: '/j/',
    type: 'consonant',
    example: 'fille',
    description: 'Voiced palatal approximant, as in fille',
  },
  {
    id: 'w',
    symbol: '/w/',
    type: 'consonant',
    example: 'oui',
    description: 'Voiced labial-velar approximant, as in oui',
  },
  {
    id: 'hw',
    symbol: '/ɥ/',
    type: 'consonant',
    example: 'huit',
    description: 'Voiced labial-palatal approximant, as in huit',
  },
];

const CATALOGUE: Readonly<Record<string, IpaLanguageCatalogue>> = {
  en: { name: 'English', phonemes: ENGLISH_PHONEMES },
  es: { name: 'Spanish', phonemes: SPANISH_PHONEMES },
  fr: { name: 'French', phonemes: FRENCH_PHONEMES },
};

export const IPA_LANGUAGE_CODES: readonly string[] = Object.keys(CATALOGUE);

const EXERCISE_PREFIX = 'ipa';
const OPTION_COUNT = 4;

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function normalizeAnswer(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

@Injectable()
export class IpaAlphabetService {
  listLanguages(): IpaLanguageSummary[] {
    return IPA_LANGUAGE_CODES.map((code) => ({
      code,
      name: CATALOGUE[code].name,
      phonemeCount: CATALOGUE[code].phonemes.length,
    }));
  }

  getCatalogue(requestedLanguage = 'en'): IpaCatalogue {
    const languageCode = this.normalizeLanguageCode(requestedLanguage);
    const language = CATALOGUE[languageCode];
    if (!language) {
      throw new BadRequestException(
        `Unsupported IPA language. Choose one of: ${IPA_LANGUAGE_CODES.join(', ')}`,
      );
    }

    return {
      languageCode,
      languageName: language.name,
      phonemes: language.phonemes.map((phoneme) => ({ ...phoneme })),
    };
  }

  getQuiz(
    requestedLanguage = 'en',
    limit = 5,
    random: () => number = Math.random,
  ): IpaQuiz {
    const languageCode = this.normalizeLanguageCode(requestedLanguage);
    const language = CATALOGUE[languageCode];
    if (!language) {
      throw new BadRequestException(
        `Unsupported IPA language. Choose one of: ${IPA_LANGUAGE_CODES.join(', ')}`,
      );
    }

    const questions = shuffle(language.phonemes, random)
      .slice(0, Math.min(limit, language.phonemes.length))
      .map((phoneme) => ({
        id: `${EXERCISE_PREFIX}:${languageCode}:${phoneme.id}`,
        symbol: phoneme.symbol,
        type: phoneme.type,
        description: phoneme.description,
        options: this.buildOptions(language, phoneme),
      }));

    return {
      languageCode,
      languageName: language.name,
      questions,
    };
  }

  checkAnswer(exerciseId: string, submittedAnswer: string): IpaAttemptResult {
    const parsed = this.parseExerciseId(exerciseId);
    const expected = parsed.phoneme.example;
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

  private buildOptions(
    language: IpaLanguageCatalogue,
    phoneme: IpaPhoneme,
  ): string[] {
    const candidates = language.phonemes
      .filter((entry) => entry.id !== phoneme.id)
      .map((entry) => entry.example);
    const options = [phoneme.example];
    const seen = new Set([normalizeAnswer(phoneme.example)]);

    for (const candidate of candidates) {
      const key = normalizeAnswer(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(candidate);
      if (options.length === OPTION_COUNT) break;
    }

    return shuffle(options, Math.random);
  }

  private parseExerciseId(exerciseId: string): {
    languageCode: string;
    phoneme: IpaPhoneme;
  } {
    const parts = exerciseId.split(':');
    if (parts.length !== 3 || parts[0] !== EXERCISE_PREFIX) {
      throw new BadRequestException('Unknown IPA exercise');
    }

    const [, languageCode, phonemeId] = parts;
    const language = CATALOGUE[languageCode];
    const phoneme = language?.phonemes.find((entry) => entry.id === phonemeId);

    if (!language || !phoneme) {
      throw new BadRequestException('Unknown IPA exercise');
    }

    return { languageCode, phoneme };
  }

  private normalizeLanguageCode(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase().replace('_', '-').split('-')[0];
  }
}
