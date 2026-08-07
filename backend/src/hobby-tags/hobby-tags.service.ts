import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface VocabularyWord {
  word: string;
  translation: string;
  language: string;
}

export interface HobbyTag {
  id: string;
  name: string;
  category: string;
  icon: string;
  target_vocabulary: VocabularyWord[];
  created_at: string;
}

export interface UserHobbyTag {
  id: string;
  user_id: string;
  hobby_tag_id: string;
  proficiency_level: number;
  created_at: string;
  hobby_tag?: HobbyTag;
}

const HOBBY_VOCABULARY_MAP: Record<string, Record<string, string[]>> = {
  Photography: {
    en: ['camera', 'lens', 'aperture', 'shutter', 'exposure', 'portrait', 'landscape', 'flash', 'tripod', 'focus'],
    es: ['cámara', 'lente', 'apertura', 'obturador', 'exposición', 'retrato', 'paisaje', 'flash', 'trípode', 'enfoque'],
    fr: ['appareil photo', 'objectif', 'ouverture', 'obturateur', 'exposition', 'portrait', 'paysage', 'flash', 'trépied', 'mise au point'],
    de: ['Kamera', 'Objektiv', 'Blende', 'Verschluss', 'Belichtung', 'Porträt', 'Landschaft', 'Blitz', 'Stativ', 'Fokus'],
    ja: ['カメラ', 'レンズ', '絞り', 'シャッター', '露出', 'ポートレート', '風景', 'フラッシュ', '三脚', 'フォーカス'],
    ko: ['카메라', '렌즈', '조리개', '셔터', '노출', '인물사진', '풍경', '플래시', '삼각대', '초점'],
    zh: ['相机', '镜头', '光圈', '快门', '曝光', '人像', '风景', '闪光灯', '三脚架', '对焦'],
    ar: ['كاميرا', 'عدسة', 'فتحة', 'غالق', 'تعريض', 'بورتريه', 'منظر طبيعي', 'فلاش', 'حامل ثلاثي', 'تركيز'],
  },
  Gaming: {
    en: ['console', 'controller', 'multiplayer', 'quest', 'level', 'score', 'strategy', 'avatar', 'rank', 'achievement'],
    es: ['consola', 'control', 'multijugador', 'misión', 'nivel', 'puntuación', 'estrategia', 'avatar', 'rango', 'logro'],
    fr: ['console', 'manette', 'multijoueur', 'quête', 'niveau', 'score', 'stratégie', 'avatar', 'rang', 'succès'],
    de: ['Konsole', 'Controller', 'Mehrspieler', 'Quest', 'Level', 'Punktzahl', 'Strategie', 'Avatar', 'Rang', 'Erfolg'],
    ja: ['コンソール', 'コントローラー', 'マルチプレイヤー', 'クエスト', 'レベル', 'スコア', '戦略', 'アバター', 'ランク', '実績'],
    ko: ['콘솔', '컨트롤러', '멀티플레이어', '퀘스트', '레벨', '점수', '전략', '아바타', '랭크', '업적'],
    zh: ['游戏机', '手柄', '多人游戏', '任务', '等级', '分数', '策略', '头像', '排名', '成就'],
    ar: ['جهاز ألعاب', 'وحدة تحكم', 'متعدد اللاعبين', 'مهمة', 'مستوى', 'نتيجة', 'استراتيجية', 'أفاتار', 'رتبة', 'إنجاز'],
  },
  Cooking: {
    en: ['recipe', 'ingredient', 'flavour', 'bake', 'roast', 'simmer', 'chopping', 'seasoning', 'marinade', 'garnish'],
    es: ['receta', 'ingrediente', 'sabor', 'hornear', 'asar', 'hervir a fuego lento', 'picar', 'condimento', 'adobo', 'guarnición'],
    fr: ['recette', 'ingrédient', 'saveur', 'cuire au four', 'rôtir', 'mijoter', 'hacher', 'assaisonnement', 'marinade', 'garniture'],
    de: ['Rezept', 'Zutat', 'Geschmack', 'backen', 'braten', 'köcheln', 'hacken', 'Würze', 'Marinade', 'Garnierung'],
    ja: ['レシピ', '材料', '味', '焼く', 'ロースト', '煮込む', '刻む', '調味料', 'マリネ', '付け合わせ'],
    ko: ['레시피', '재료', '맛', '굽다', '로스트', '끓이다', '다지기', '양념', '마리네이드', '고명'],
    zh: ['食谱', '食材', '味道', '烘烤', '烤', '炖', '切碎', '调味', '腌制', '装饰'],
    ar: ['وصفة', 'مكون', 'نكهة', 'خبز', 'شوي', 'طهي على نار هادئة', 'تقطيع', 'تتبيل', 'تتبيلة', 'تزيين'],
  },
  Travelling: {
    en: ['itinerary', 'destination', 'suitcase', 'passport', 'boarding', 'sightseeing', 'accommodation', 'guide', 'backpack', 'adventure'],
    es: ['itinerario', 'destino', 'maleta', 'pasaporte', 'embarque', 'turismo', 'alojamiento', 'guía', 'mochila', 'aventura'],
    fr: ['itinéraire', 'destination', 'valise', 'passeport', 'embarquement', 'visites', 'hébergement', 'guide', 'sac à dos', 'aventure'],
    de: ['Reiseplan', 'Reiseziel', 'Koffer', 'Reisepass', 'Boarding', 'Besichtigung', 'Unterkunft', 'Führer', 'Rucksack', 'Abenteuer'],
    ja: ['旅程', '目的地', 'スーツケース', 'パスポート', '搭乗', '観光', '宿泊', 'ガイド', 'バックパック', '冒険'],
    ko: ['여정', '목적지', '여행가방', '여권', '탑승', '관광', '숙소', '가이드', '배낭', '모험'],
    zh: ['行程', '目的地', '行李箱', '护照', '登机', '观光', '住宿', '导游', '背包', '冒险'],
    ar: ['مسار الرحلة', 'وجهة', 'حقيبة سفر', 'جواز سفر', 'صعود', 'مشاهدة المعالم', 'إقامة', 'دليل', 'حقيبة ظهر', 'مغامرة'],
  },
  Music: {
    en: ['melody', 'rhythm', 'instrument', 'lyrics', 'chord', 'harmony', 'tempo', 'verse', 'chorus', 'genre'],
    es: ['melodía', 'ritmo', 'instrumento', 'letra', 'acorde', 'armonía', 'tempo', 'verso', 'estribillo', 'género'],
    fr: ['mélodie', 'rythme', 'instrument', 'paroles', 'accord', 'harmonie', 'tempo', 'couplet', 'refrain', 'genre'],
    de: ['Melodie', 'Rhythmus', 'Instrument', 'Text', 'Akkord', 'Harmonie', 'Tempo', 'Strophe', 'Refrain', 'Genre'],
    ja: ['メロディー', 'リズム', '楽器', '歌詞', 'コード', 'ハーモニー', 'テンポ', '詩', 'コーラス', 'ジャンル'],
    ko: ['멜로디', '리듬', '악기', '가사', '코드', '하모니', '템포', '절', '코러스', '장르'],
    zh: ['旋律', '节奏', '乐器', '歌词', '和弦', '和声', '速度', '段落', '合唱', '流派'],
    ar: ['لحن', 'إيقاع', 'آلة موسيقية', 'كلمات', 'وتر', 'تناغم', 'إيقاع', 'مقطع', 'جوقة', 'نوع'],
  },
  Reading: {
    en: ['novel', 'chapter', 'author', 'genre', 'plot', 'character', 'page', 'bookmark', 'library', 'fiction'],
    es: ['novela', 'capítulo', 'autor', 'género', 'trama', 'personaje', 'página', 'marcapáginas', 'biblioteca', 'ficción'],
    fr: ['roman', 'chapitre', 'auteur', 'genre', 'intrigue', 'personnage', 'page', 'marque-page', 'bibliothèque', 'fiction'],
    de: ['Roman', 'Kapitel', 'Autor', 'Genre', 'Handlung', 'Figur', 'Seite', 'Lesezeichen', 'Bibliothek', 'Fiktion'],
    ja: ['小説', '章', '著者', 'ジャンル', '筋書き', '登場人物', 'ページ', 'しおり', '図書館', 'フィクション'],
    ko: ['소설', '장', '저자', '장르', '줄거리', '등장인물', '페이지', '책갈피', '도서관', '픽션'],
    zh: ['小说', '章节', '作者', '体裁', '情节', '人物', '页', '书签', '图书馆', '虚构'],
    ar: ['رواية', 'فصل', 'مؤلف', 'نوع أدبي', 'حبكة', 'شخصية', 'صفحة', 'علامة مرجعية', 'مكتبة', 'خيال'],
  },
  Fitness: {
    en: ['exercise', 'workout', 'cardio', 'strength', 'flexibility', 'endurance', 'calories', 'routine', 'trainer', 'stretch'],
    es: ['ejercicio', 'entrenamiento', 'cardio', 'fuerza', 'flexibilidad', 'resistencia', 'calorías', 'rutina', 'entrenador', 'estiramiento'],
    fr: ['exercice', 'entraînement', 'cardio', 'force', 'flexibilité', 'endurance', 'calories', 'routine', 'entraîneur', 'étirement'],
    de: ['Übung', 'Training', 'Cardio', 'Kraft', 'Flexibilität', 'Ausdauer', 'Kalorien', 'Routine', 'Trainer', 'Dehnung'],
    ja: ['運動', 'ワークアウト', '有酸素運動', '筋力', '柔軟性', '持久力', 'カロリー', 'ルーティン', 'トレーナー', 'ストレッチ'],
    ko: ['운동', '워크아웃', '유산소', '근력', '유연성', '지구력', '칼로리', '루틴', '트레이너', '스트레칭'],
    zh: ['运动', '锻炼', '有氧', '力量', '柔韧性', '耐力', '卡路里', '日常', '教练', '拉伸'],
    ar: ['تمرين', 'تدريب', 'تمارين القلب', 'قوة', 'مرونة', 'تحمل', 'سعرات حرارية', 'روتين', 'مدرب', 'تمدد'],
  },
  Art: {
    en: ['canvas', 'brush', 'palette', 'sketch', 'gallery', 'sculpture', 'portrait', 'abstract', 'texture', 'composition'],
    es: ['lienzo', 'pincel', 'paleta', 'boceto', 'galería', 'escultura', 'retrato', 'abstracto', 'textura', 'composición'],
    fr: ['toile', 'pinceau', 'palette', 'croquis', 'galerie', 'sculpture', 'portrait', 'abstrait', 'texture', 'composition'],
    de: ['Leinwand', 'Pinsel', 'Palette', 'Skizze', 'Galerie', 'Skulptur', 'Porträt', 'abstrakt', 'Textur', 'Komposition'],
    ja: ['キャンバス', '筆', 'パレット', 'スケッチ', 'ギャラリー', '彫刻', '肖像', '抽象', '質感', '構図'],
    ko: ['캔버스', '붓', '팔레트', '스케치', '갤러리', '조각', '초상화', '추상', '질감', '구성'],
    zh: ['画布', '画笔', '调色板', '素描', '画廊', '雕塑', '肖像', '抽象', '纹理', '构图'],
    ar: ['قماش', 'فرشاة', 'لوحة ألوان', 'رسم تخطيطي', 'معرض', 'نحت', 'بورتريه', 'تجريدي', 'ملمس', 'تكوين'],
  },
  Dancing: {
    en: ['choreography', 'rhythm', 'routine', 'freestyle', 'partner', 'footwork', 'spin', 'balance', 'posture', 'tempo'],
    es: ['coreografía', 'ritmo', 'rutina', 'estilo libre', 'pareja', 'juego de pies', 'giro', 'equilibrio', 'postura', 'tempo'],
    fr: ['chorégraphie', 'rythme', 'routine', 'freestyle', 'partenaire', 'jeu de jambes', 'tour', 'équilibre', 'posture', 'tempo'],
    de: ['Choreografie', 'Rhythmus', 'Routine', 'Freestyle', 'Partner', 'Beinarbeit', 'Drehung', 'Balance', 'Haltung', 'Tempo'],
    ja: ['振付', 'リズム', 'ルーティン', 'フリースタイル', 'パートナー', 'フットワーク', 'スピン', 'バランス', '姿勢', 'テンポ'],
    ko: ['안무', '리듬', '루틴', '프리스타일', '파트너', '풋워크', '스핀', '균형', '자세', '템포'],
    zh: ['编舞', '节奏', '套路', '自由式', '舞伴', '步法', '旋转', '平衡', '姿势', '节拍'],
    ar: ['تصميم الرقصات', 'إيقاع', 'روتين', 'أسلوب حر', 'شريك', 'حركة القدمين', 'دوران', 'توازن', 'وضعية', 'إيقاع'],
  },
};

function buildVocabularyForTag(
  tagName: string,
  sourceWords: string[],
  translations: Record<string, string[]>,
): VocabularyWord[] {
  const vocabulary: VocabularyWord[] = [];
  for (const [lang, words] of Object.entries(translations)) {
    for (let i = 0; i < sourceWords.length && i < words.length; i++) {
      vocabulary.push({
        word: sourceWords[i],
        translation: words[i],
        language: lang,
      });
    }
  }
  return vocabulary;
}

function generateVocabularyForTagName(tagName: string): VocabularyWord[] {
  const baseVocab = HOBBY_VOCABULARY_MAP[tagName];
  if (!baseVocab) return [];
  const sourceWords = baseVocab['en'];
  if (!sourceWords) return [];

  const translations: Record<string, string[]> = {};
  for (const [lang, words] of Object.entries(baseVocab)) {
    if (lang !== 'en') {
      translations[lang] = words;
    }
  }
  return buildVocabularyForTag(tagName, sourceWords, translations);
}

@Injectable()
export class HobbyTagsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getAllTags(): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('hobby_tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createTag(
    name: string,
    category: string,
    icon: string = '✨',
  ): Promise<any> {
    const formattedName = name
      .trim()
      .split(/\s+/)
      .map((word, index) => {
        if (index === 0) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join('');

    const vocabulary = generateVocabularyForTagName(formattedName);

    const supabase = this.supabaseService.getClient();
    const insertResponse = await supabase
      .from('hobby_tags')
      .insert({
        name: formattedName,
        category,
        icon,
        target_vocabulary: vocabulary,
      })
      .select()
      .single();

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
  }

  async getVocabularyForTag(
    tagId: string,
    language: string,
  ): Promise<VocabularyWord[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('hobby_tags')
      .select('target_vocabulary, name')
      .eq('id', tagId)
      .single();

    if (error || !data) throw new NotFoundException('Hobby tag not found');

    const vocabulary: VocabularyWord[] = (data.target_vocabulary || []) as VocabularyWord[];
    if (language) {
      return vocabulary.filter((v) => v.language === language);
    }
    return vocabulary;
  }

  async getUserVocabulary(
    userId: string,
    language: string,
  ): Promise<Array<{ id: string; word: string; translation: string; hobbyTagName: string; difficulty: string; context_sentence?: string; hobby_tag?: { icon: string; name: string } }>> {
    const supabase = this.supabaseService.getClient();

    const { data: userTags, error: utError } = await supabase
      .from('user_hobby_tags')
      .select('hobby_tag_id, hobby_tag:hobby_tags(name, icon, target_vocabulary)')
      .eq('user_id', userId);

    if (utError) throw utError;
    if (!userTags || userTags.length === 0) return [];

    const result: Array<{
      id: string;
      word: string;
      translation: string;
      hobbyTagName: string;
      difficulty: string;
      context_sentence?: string;
      hobby_tag?: { icon: string; name: string };
    }> = [];

    for (const ut of userTags) {
      const tag = ut.hobby_tag as unknown as { name: string; icon: string; target_vocabulary: VocabularyWord[] } | null;
      if (!tag || !tag.target_vocabulary) continue;

      const filteredVocab = language
        ? tag.target_vocabulary.filter((v) => v.language === language)
        : tag.target_vocabulary;

      for (const v of filteredVocab) {
        result.push({
          id: `vocab-${ut.hobby_tag_id}-${v.word}-${v.language}`,
          word: v.word,
          translation: v.translation,
          hobbyTagName: tag.name,
          difficulty: 'beginner',
          context_sentence: `Learn this word from your ${tag.name} hobby vocabulary.`,
          hobby_tag: { icon: tag.icon, name: tag.name },
        });
      }
    }

    return result;
  }

  async getUserTags(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('user_hobby_tags')
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  async addUserTag(
    userId: string,
    hobbyTagId: string,
    proficiencyLevel?: number,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();

    // Verify hobby tag exists
    const { data: tag, error: tagError } = await supabase
      .from('hobby_tags')
      .select('id')
      .eq('id', hobbyTagId)
      .single();

    if (tagError || !tag) {
      throw new NotFoundException('Hobby tag not found');
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('user_hobby_tags')
      .select('id')
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId)
      .single();

    if (existing) {
      throw new ConflictException('Hobby tag already added');
    }

    const insertResponse = await supabase
      .from('user_hobby_tags')
      .insert({
        user_id: userId,
        hobby_tag_id: hobbyTagId,
        proficiency_level: proficiencyLevel || 0,
      })
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .single();

    if (insertResponse.error) throw insertResponse.error;
    return insertResponse.data;
  }

  async removeUserTag(userId: string, hobbyTagId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_hobby_tags')
      .delete()
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId);

    if (error) throw error;
  }

  async updateProficiency(
    userId: string,
    hobbyTagId: string,
    proficiencyLevel: number,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const updateResponse = await supabase
      .from('user_hobby_tags')
      .update({ proficiency_level: proficiencyLevel })
      .eq('user_id', userId)
      .eq('hobby_tag_id', hobbyTagId)
      .select(
        `
        *,
        hobby_tag:hobby_tags(*)
      `,
      )
      .single();

    if (updateResponse.error) throw updateResponse.error;
    if (!updateResponse.data)
      throw new NotFoundException('User hobby tag not found');
    return updateResponse.data;
  }
}
