import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface WordOfTheDay {
  word: string;
  translation: string;
  language: string;
  languageCode: string;
  example: string;
  date: string;
}

type WordEntry = Omit<WordOfTheDay, 'language' | 'languageCode' | 'date'>;

type LanguageCatalog = {
  name: string;
  words: readonly WordEntry[];
};

const CATALOG: Readonly<Record<string, LanguageCatalog>> = {
  en: {
    name: 'English',
    words: [
      {
        word: 'curious',
        translation: 'eager to know or learn',
        example: 'She is curious about other cultures.',
      },
      {
        word: 'practice',
        translation: 'repeat an activity to improve',
        example: 'A little practice every day builds confidence.',
      },
      {
        word: 'journey',
        translation: 'a trip or process of development',
        example: 'Learning a language is a long journey.',
      },
      {
        word: 'kind',
        translation: 'friendly and considerate',
        example: 'It was kind of him to correct my sentence.',
      },
      {
        word: 'notice',
        translation: 'become aware of something',
        example: 'Try to notice the words people use naturally.',
      },
      {
        word: 'share',
        translation: 'give or use something together',
        example: 'We share new expressions after class.',
      },
      {
        word: 'progress',
        translation: 'movement towards a goal',
        example: 'Small habits can create steady progress.',
      },
    ],
  },
  es: {
    name: 'Spanish',
    words: [
      {
        word: 'aprender',
        translation: 'to learn',
        example: 'Quiero aprender algo nuevo cada día.',
      },
      {
        word: 'charlar',
        translation: 'to chat',
        example: 'Nos gusta charlar después de clase.',
      },
      {
        word: 'amable',
        translation: 'kind / friendly',
        example: 'La gente fue muy amable conmigo.',
      },
      {
        word: 'mejorar',
        translation: 'to improve',
        example: 'Quiero mejorar mi pronunciación.',
      },
      {
        word: 'costumbre',
        translation: 'habit / custom',
        example: 'Leer por la mañana es una buena costumbre.',
      },
      {
        word: 'compartir',
        translation: 'to share',
        example: 'Podemos compartir nuestras ideas.',
      },
      {
        word: 'logro',
        translation: 'achievement',
        example: 'Terminar el curso fue un gran logro.',
      },
    ],
  },
  fr: {
    name: 'French',
    words: [
      {
        word: 'apprendre',
        translation: 'to learn',
        example: "J'aime apprendre de nouveaux mots.",
      },
      {
        word: 'échanger',
        translation: 'to exchange',
        example: 'Nous pouvons échanger des idées.',
      },
      {
        word: 'progrès',
        translation: 'progress',
        example: 'Tu fais de vrais progrès.',
      },
      {
        word: 'habitude',
        translation: 'habit',
        example: 'Lire chaque soir est une bonne habitude.',
      },
      {
        word: 'accueillir',
        translation: 'to welcome',
        example: 'Ils aiment accueillir les nouveaux étudiants.',
      },
      {
        word: 'oser',
        translation: 'to dare',
        example: 'Il faut oser parler pour progresser.',
      },
      {
        word: 'partager',
        translation: 'to share',
        example: 'Nous partageons nos conseils de voyage.',
      },
    ],
  },
  de: {
    name: 'German',
    words: [
      {
        word: 'lernen',
        translation: 'to learn',
        example: 'Ich lerne jeden Tag neue Wörter.',
      },
      {
        word: 'üben',
        translation: 'to practise',
        example: 'Wir üben heute die Aussprache.',
      },
      {
        word: 'freundlich',
        translation: 'friendly',
        example: 'Die Lehrerin ist sehr freundlich.',
      },
      {
        word: 'Fortschritt',
        translation: 'progress',
        example: 'Du machst guten Fortschritt.',
      },
      {
        word: 'Gewohnheit',
        translation: 'habit',
        example: 'Lesen ist eine gute Gewohnheit.',
      },
      {
        word: 'teilen',
        translation: 'to share',
        example: 'Wir teilen unsere Erfahrungen.',
      },
      {
        word: 'neugierig',
        translation: 'curious',
        example: 'Ich bin neugierig auf andere Kulturen.',
      },
    ],
  },
  it: {
    name: 'Italian',
    words: [
      {
        word: 'imparare',
        translation: 'to learn',
        example: 'Voglio imparare una parola nuova ogni giorno.',
      },
      {
        word: 'gentile',
        translation: 'kind / polite',
        example: 'La cameriera è stata molto gentile.',
      },
      {
        word: 'migliorare',
        translation: 'to improve',
        example: 'Cerco di migliorare la mia pronuncia.',
      },
      {
        word: 'abitudine',
        translation: 'habit',
        example: 'Leggere ogni sera è una buona abitudine.',
      },
      {
        word: 'condividere',
        translation: 'to share',
        example: 'Mi piace condividere nuove idee.',
      },
      {
        word: 'curioso',
        translation: 'curious',
        example: 'Sono curioso di conoscere la città.',
      },
      {
        word: 'traguardo',
        translation: 'goal / milestone',
        example: 'Questo esame è un traguardo importante.',
      },
    ],
  },
  pt: {
    name: 'Portuguese',
    words: [
      {
        word: 'aprender',
        translation: 'to learn',
        example: 'Quero aprender uma palavra nova por dia.',
      },
      {
        word: 'praticar',
        translation: 'to practise',
        example: 'Precisamos praticar a pronúncia.',
      },
      {
        word: 'gentil',
        translation: 'kind',
        example: 'Ela foi muito gentil comigo.',
      },
      {
        word: 'melhorar',
        translation: 'to improve',
        example: 'Quero melhorar o meu vocabulário.',
      },
      {
        word: 'hábito',
        translation: 'habit',
        example: 'Ler todos os dias é um bom hábito.',
      },
      {
        word: 'compartilhar',
        translation: 'to share',
        example: 'Vamos compartilhar nossas ideias.',
      },
      {
        word: 'progresso',
        translation: 'progress',
        example: 'Seu progresso está ficando evidente.',
      },
    ],
  },
  ja: {
    name: 'Japanese',
    words: [
      {
        word: '学ぶ',
        translation: 'to learn',
        example: '毎日、新しいことを学びます。',
      },
      {
        word: '練習',
        translation: 'practice',
        example: '毎朝、日本語を練習します。',
      },
      {
        word: '優しい',
        translation: 'kind / gentle',
        example: '先生はとても優しいです。',
      },
      {
        word: '習慣',
        translation: 'habit',
        example: '読むことを習慣にしています。',
      },
      {
        word: '挑戦',
        translation: 'challenge',
        example: '新しいことに挑戦したいです。',
      },
      {
        word: '伝える',
        translation: 'to convey / tell',
        example: '自分の気持ちを日本語で伝えます。',
      },
      {
        word: '上達',
        translation: 'improvement',
        example: '毎日の会話で日本語が上達しました。',
      },
    ],
  },
  ko: {
    name: 'Korean',
    words: [
      {
        word: '배우다',
        translation: 'to learn',
        example: '저는 매일 새로운 단어를 배워요.',
      },
      {
        word: '연습',
        translation: 'practice',
        example: '매일 발음을 연습해요.',
      },
      {
        word: '친절하다',
        translation: 'to be kind',
        example: '그 선생님은 정말 친절해요.',
      },
      {
        word: '습관',
        translation: 'habit',
        example: '매일 읽는 습관을 만들었어요.',
      },
      {
        word: '도전',
        translation: 'challenge',
        example: '새로운 표현에 도전해 봐요.',
      },
      {
        word: '나누다',
        translation: 'to share',
        example: '친구와 생각을 나눴어요.',
      },
      {
        word: '발전',
        translation: 'progress / development',
        example: '실력이 많이 발전했어요.',
      },
    ],
  },
  zh: {
    name: 'Chinese',
    words: [
      {
        word: '学习',
        translation: 'to study / learn',
        example: '我每天学习新的单词。',
      },
      {
        word: '练习',
        translation: 'to practise',
        example: '我们一起练习发音。',
      },
      { word: '友好', translation: 'friendly', example: '这里的人都很友好。' },
      { word: '习惯', translation: 'habit', example: '每天阅读是一个好习惯。' },
      {
        word: '挑战',
        translation: 'challenge',
        example: '学习语言也是一种挑战。',
      },
      {
        word: '分享',
        translation: 'to share',
        example: '我喜欢分享学习方法。',
      },
      { word: '进步', translation: 'progress', example: '你的中文进步很快。' },
    ],
  },
};

const DAY_MS = 86_400_000;

@Injectable()
export class WordOfTheDayService {
  private readonly logger = new Logger(WordOfTheDayService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getTodayWordForUser(
    userId: string,
    now = new Date(),
  ): Promise<WordOfTheDay> {
    const languageCode = await this.resolveUserLanguage(userId);
    return this.getWordForDate(languageCode, now);
  }

  getWordForDate(requestedLanguage: string, now = new Date()): WordOfTheDay {
    const normalized = this.normalizeLanguageCode(requestedLanguage);
    const languageCode = CATALOG[normalized] ? normalized : 'en';
    const catalog = CATALOG[languageCode];
    const utcDay = Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) /
        DAY_MS,
    );
    const languageOffset = [...languageCode].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );
    const entry =
      catalog.words[(utcDay + languageOffset) % catalog.words.length];

    return {
      ...entry,
      language: catalog.name,
      languageCode,
      date: now.toISOString().slice(0, 10),
    };
  }

  private async resolveUserLanguage(userId: string): Promise<string> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('target_languages, native_languages')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.warn(
          `Word of the day profile lookup failed (${error.code ?? 'unknown'})`,
        );
        return 'en';
      }

      const user = data as {
        target_languages?: string[] | null;
        native_languages?: string[] | null;
      } | null;
      return user?.target_languages?.[0] ?? user?.native_languages?.[0] ?? 'en';
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      this.logger.warn(`Word of the day profile lookup failed (${reason})`);
      return 'en';
    }
  }

  private normalizeLanguageCode(value: string | null | undefined): string {
    const code = (value ?? '')
      .trim()
      .toLowerCase()
      .replace('_', '-')
      .split('-')[0];
    if (code === 'jp') return 'ja';
    return code || 'en';
  }
}
