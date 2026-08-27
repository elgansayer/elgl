import { UserProfile } from '../users/interfaces/user-profile.interface';
import {
  DEFAULT_MOCK_FIXTURE_SEED,
  DeterministicFixtureGenerator,
  getMockFixtureDiagnostics,
} from './deterministic-fixtures';

export const MOCK_USER_POPULATION_SCHEMA_VERSION =
  'mock-user-population-v1' as const;

export const MOCK_USER_POPULATION_COUNTS = {
  minimal: 12,
  medium: 96,
  large: 512,
} as const;

export type MockUserPopulationSize = keyof typeof MOCK_USER_POPULATION_COUNTS;

interface LocaleTemplate {
  country: string;
  city: string;
  region: string;
  timezone: string;
  nativeLanguage: string;
  names: readonly string[];
  bios: readonly string[];
}

const LOCALE_TEMPLATES: readonly LocaleTemplate[] = [
  {
    country: 'Japan',
    city: 'Tokyo',
    region: 'Kanto',
    timezone: 'Asia/Tokyo',
    nativeLanguage: 'ja',
    names: ['さくら', '悠真', '美咲'],
    bios: ['日本語を教えながら英語を練習したいです。', '本と料理が好きです。'],
  },
  {
    country: 'United Kingdom',
    city: 'Manchester',
    region: 'England',
    timezone: 'Europe/London',
    nativeLanguage: 'en',
    names: ['Maya Rivers', 'Theo Bennett', 'Nia Morgan'],
    bios: ['Learning languages through music and everyday conversation.'],
  },
  {
    country: 'Egypt',
    city: 'Alexandria',
    region: 'Alexandria Governorate',
    timezone: 'Africa/Cairo',
    nativeLanguage: 'ar',
    names: ['ليان منصور', 'عمر نجيب', 'نور حسان'],
    bios: ['أحب تبادل اللغات والتعرف على ثقافات جديدة.'],
  },
  {
    country: 'Israel',
    city: 'Haifa',
    region: 'Haifa District',
    timezone: 'Asia/Jerusalem',
    nativeLanguage: 'he',
    names: ['נועה לוי', 'איתי כהן', 'מיה רז'],
    bios: ['מחפשת שיחות קצרות לתרגול שפה בכל יום.'],
  },
  {
    country: 'South Korea',
    city: 'Busan',
    region: 'Busan',
    timezone: 'Asia/Seoul',
    nativeLanguage: 'ko',
    names: ['민준', '서연', '지우'],
    bios: ['언어 교환과 여행 이야기를 좋아해요.'],
  },
  {
    country: 'India',
    city: 'Pune',
    region: 'Maharashtra',
    timezone: 'Asia/Kolkata',
    nativeLanguage: 'hi',
    names: ['अनया शर्मा', 'विवान मेहता', 'मीरा जोशी'],
    bios: ['नई भाषाएँ सीखना और कहानियाँ पढ़ना पसंद है।'],
  },
  {
    country: 'Mexico',
    city: 'Guadalajara',
    region: 'Jalisco',
    timezone: 'America/Mexico_City',
    nativeLanguage: 'es',
    names: ['Sofía Núñez', 'Mateo Álvarez', 'Renata Díaz'],
    bios: ['Quiero practicar con conversaciones naturales y tranquilas.'],
  },
  {
    country: 'Brazil',
    city: 'Recife',
    region: 'Pernambuco',
    timezone: 'America/Recife',
    nativeLanguage: 'pt',
    names: ['João Araújo', 'Lívia Gonçalves', 'Caio Luz'],
    bios: ['Gosto de idiomas, praia e trocar recomendações de livros.'],
  },
  {
    country: 'Türkiye',
    city: 'İzmir',
    region: 'Aegean',
    timezone: 'Europe/Istanbul',
    nativeLanguage: 'tr',
    names: ['İpek Yılmaz', 'Çağrı Demir', 'Ece Şahin'],
    bios: ['Günlük konuşma pratiği yapmak ve yeni kültürler öğrenmek istiyorum.'],
  },
  {
    country: 'Vietnam',
    city: 'Đà Nẵng',
    region: 'Central Vietnam',
    timezone: 'Asia/Ho_Chi_Minh',
    nativeLanguage: 'vi',
    names: ['Nguyễn Thảo Vy', 'Trần Minh Quân', 'Lê Bảo An'],
    bios: ['Mình muốn luyện nói tự nhiên và kết bạn qua trao đổi ngôn ngữ.'],
  },
  {
    country: 'France',
    city: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    timezone: 'Europe/Paris',
    nativeLanguage: 'fr',
    names: ['Chloé Moreau', 'Maël Dubois', 'Anaïs Bernard'],
    bios: ['Je cherche des échanges réguliers et bienveillants.'],
  },
  {
    country: 'Poland',
    city: 'Wrocław',
    region: 'Lower Silesia',
    timezone: 'Europe/Warsaw',
    nativeLanguage: 'pl',
    names: ['Łukasz Nowak', 'Zofia Kowalska', 'Michał Zieliński'],
    bios: ['Lubię języki, gry planszowe i spokojne rozmowy.'],
  },
] as const;

const PROFICIENCY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const GENDERS = ['female', 'male', 'nonbinary', 'prefer_not_to_say'] as const;
const LONG_DISPLAY_NAME =
  'Alexandria-Catherine Fernández-Watanabe de la Cruz-Sørensen, Language Exchange Enthusiast';

export interface MockUserPopulationDataset {
  schemaVersion: typeof MOCK_USER_POPULATION_SCHEMA_VERSION;
  namespace: string;
  size: MockUserPopulationSize;
  count: number;
  seed: number;
  seedId: string;
  profiles: UserProfile[];
}

export function deriveMockPopulationSeed(
  namespace: string,
  baseSeed = DEFAULT_MOCK_FIXTURE_SEED,
): number {
  let hash = 0x811c9dc5;
  for (const character of namespace) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (baseSeed ^ (hash >>> 0)) >>> 0;
}

function createProfile(
  generator: DeterministicFixtureGenerator,
  index: number,
): UserProfile {
  const locale = LOCALE_TEMPLATES[index % LOCALE_TEMPLATES.length];
  const targetLocale =
    LOCALE_TEMPLATES[(index + 1 + generator.integer(0, 3)) % LOCALE_TEMPLATES.length];
  const isVip = index % 11 === 0;
  const displayName =
    index === 3
      ? undefined
      : index === 4
        ? LONG_DISPLAY_NAME
        : generator.pick(locale.names);
  const nativeLanguages = [locale.nativeLanguage];
  const targetLanguages = [targetLocale.nativeLanguage];
  const createdOffsetMs = -index * 86_400_000;

  return {
    id: generator.uuid(),
    display_name: displayName,
    native_languages: nativeLanguages,
    target_languages: targetLanguages,
    language_pairs: [
      {
        native: locale.nativeLanguage,
        target: targetLocale.nativeLanguage,
      },
    ],
    default_translation_language: targetLocale.nativeLanguage,
    bio_text: generator.pick(locale.bios),
    interests: generator.pick([
      ['books', 'food'],
      ['music', 'travel'],
      ['films', 'fitness'],
      ['technology', 'culture'],
    ]),
    hobbies: generator.pick([
      ['reading', 'walking'],
      ['cooking', 'photography'],
      ['cycling', 'gaming'],
      ['drawing', 'music'],
    ]),
    location: `${locale.city}, ${locale.country}`,
    is_vip: isVip,
    vip_tier: isVip ? 'vip' : 'free',
    coins_balance: generator.integer(0, 5000),
    study_streak_days: generator.integer(0, 365),
    correction_ratio: Number(generator.random().toFixed(2)),
    is_serious_learner: index % 3 === 0,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    matchmaking_consent: true,
    privacy_hide_gender: false,
    privacy_hide_exact_location: true,
    location_privacy: 'region',
    privacy_hide_online_status: false,
    privacy_hide_vip_status: false,
    privacy_last_seen: 'everyone',
    privacy_profile_photo: 'everyone',
    privacy_about_info: 'everyone',
    privacy_status: 'everyone',
    nationality: locale.country,
    region: locale.region,
    age: generator.integer(18, 68),
    gender: generator.pick(GENDERS),
    proficiency_level: generator.pick(PROFICIENCY_LEVELS),
    learning_goals: 'conversation, listening, vocabulary',
    availability_morning: generator.boolean(),
    availability_afternoon: generator.boolean(),
    availability_evening: generator.boolean(),
    created_at: generator.timestamp(createdOffsetMs),
    joined_at: generator.timestamp(createdOffsetMs),
    last_active_at: generator.timestamp(-generator.integer(0, 7) * 3_600_000),
    do_not_disturb: false,
    auto_play_voice_notes: false,
    chat_enter_to_send: true,
    chat_text_size: 'medium',
    auto_download_media: true,
    auto_download_wifi_only: true,
    auto_download_preference: 'wifi',
    silence_unknown_callers: false,
  };
}

export function buildGlobalMockUserPopulation(
  size: MockUserPopulationSize = 'medium',
  namespace = 'default',
  baseSeed = DEFAULT_MOCK_FIXTURE_SEED,
): MockUserPopulationDataset {
  const count = MOCK_USER_POPULATION_COUNTS[size];
  const seed = deriveMockPopulationSeed(namespace, baseSeed);
  const generator = new DeterministicFixtureGenerator(seed);
  const diagnostics = getMockFixtureDiagnostics(seed);
  const profiles = Array.from({ length: count }, (_, index) =>
    createProfile(generator, index),
  );

  return {
    schemaVersion: MOCK_USER_POPULATION_SCHEMA_VERSION,
    namespace,
    size,
    count,
    seed,
    seedId: `${diagnostics.seedId}:${namespace}`,
    profiles,
  };
}
