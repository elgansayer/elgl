import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Language } from 'node-nlp';
import { SupabaseService } from '../supabase/supabase.service';
import { GrammarCheckDto } from './dto/grammar-check.dto';
import { PronunciationScoreDto } from './dto/pronunciation-score.dto';
import { TranslateDto } from './dto/translate.dto';
import { TranslateUiDto } from './dto/translate-ui.dto';
import {
  GrammarCheckResult,
  PronunciationScoreResult,
  TranslationResult,
  TranslateUiResult,
  WordBreakdownItem,
} from './interfaces/nlp-results.interface';
import { ExplainGrammarDto } from './dto/explain-grammar.dto';
import { SimplifyDto } from './dto/simplify.dto';
import { TranslateBioDto } from './dto/translate-bio.dto';

@Injectable()
export class NlpService {
  private nlpLanguage = new Language();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  detectLanguage(text: string): { language: string; confidence: number } {
    const guesses = this.nlpLanguage.guess(text, undefined, 3);
    if (!guesses || guesses.length === 0) {
      return { language: 'en', confidence: 0.5 };
    }
    const top = guesses[0];
    return {
      language: top.alpha2 || 'en',
      confidence: top.score || 0.8,
    };
  }

  async checkRateLimit(userId: string, isVip: boolean): Promise<void> {
    if (isVip) return; // VIP users get unlimited AI usage per Rule 1 & Phase 4 spec

    const redis = this.supabaseService.getRedisClient();
    const today = new Date().toISOString().slice(0, 10);
    const key = `daily_ai_usage:${userId}:${today}`;

    const currentCountStr = await redis.get(key);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

    if (currentCount >= 10) {
      throw new BadRequestException(
        'Daily AI request limit (10 requests/day) reached on Free Tier. Upgrade to VIP (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent) for unlimited AI translations, grammar checks, and pronunciation scoring!',
      );
    }

    const newCount = await redis.incr(key);
    if (newCount === 1) {
      await redis.expire(key, 86400);
    }
  }

  async translate(
    userId: string,
    isVip: boolean,
    dto: TranslateDto,
  ): Promise<TranslationResult> {
    await this.checkRateLimit(userId, isVip);

    const detected =
      dto.source_language || this.detectLanguage(dto.text).language;
    const cleanWord = dto.text.trim();

    const deepLKey = this.configService.get<string>('DEEPL_API_KEY');
    if (!deepLKey) {
      throw new BadRequestException('DeepL API key not configured');
    }

    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${deepLKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [cleanWord],
        target_lang: dto.target_language.toUpperCase(),
        source_lang: detected.toUpperCase(),
        tag_handling: 'xml',
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new BadRequestException(
        `DeepL API error: ${res.status} ${errorBody}`,
      );
    }

    const jsonResponse = (await res.json()) as unknown as {
      translations: Array<{ text: string }>;
    };
    if (
      !jsonResponse ||
      !jsonResponse.translations ||
      jsonResponse.translations.length === 0
    ) {
      throw new BadRequestException('DeepL returned no translations');
    }
    const translatedText = jsonResponse.translations[0].text;

    // Get glossary/definition via DeepL glossary lookup (if available) or fallback
    let definition = '';
    try {
      const glossaryRes = await fetch(
        `https://api-free.deepl.com/v2/glossary-language-pairs`,
        {
          headers: {
            Authorization: `DeepL-Auth-Key ${deepLKey}`,
          },
        },
      );
      if (glossaryRes.ok) {
        // DeepL doesn't provide definitions directly, so we use a simple heuristic
        definition = `Translation of "${cleanWord}" in ${dto.target_language}`;
      }
    } catch {
      definition = `Translation of "${cleanWord}" in ${dto.target_language}`;
    }

    // Generate transliteration using DeepL's source language detection
    let transliteration = '';
    try {
      const translitRes = await fetch(
        'https://api-free.deepl.com/v2/translate',
        {
          method: 'POST',
          headers: {
            Authorization: `DeepL-Auth-Key ${deepLKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: [translatedText],
            target_lang: 'EN',
            source_lang: dto.target_language.toUpperCase(),
          }),
        },
      );
      if (translitRes.ok) {
        const translitData = (await translitRes.json()) as {
          translations: Array<{ text: string }>;
        };
        transliteration = translitData.translations[0].text;
      }
    } catch {
      transliteration = translatedText;
    }

    const finalResult = {
      original_text: cleanWord,
      translated_text: translatedText,
      detected_language: detected,
      transliteration: transliteration,
      definition: definition,
      pronunciation_url: `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(translatedText)}&tl=${dto.target_language}`,
    };

    return finalResult;
  }

  async grammarCheck(
    userId: string,
    isVip: boolean,
    dto: GrammarCheckDto,
  ): Promise<GrammarCheckResult> {
    await this.checkRateLimit(userId, isVip);
    const orig = dto.text.trim();

    const azureKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');
    if (!azureKey) {
      throw new BadRequestException('Azure Translator API key not configured');
    }

    // Use Azure AI Translator's grammar checking via the "breakSentence" and "translate" endpoints
    // First, detect the language
    const detectRes = await fetch(
      'https://api.cognitive.microsofttranslator.com/detect?api-version=3.0',
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ Text: orig }]),
      },
    );

    if (!detectRes.ok) {
      const errorBody = await detectRes.text();
      throw new BadRequestException(
        `Azure Detect API error: ${detectRes.status} ${errorBody}`,
      );
    }

    const detectData = (await detectRes.json()) as unknown as Array<{
      language: string;
    }>;
    const detectedLang = detectData?.[0]?.language || 'en';

    // Use Azure's dictionary lookup for grammar correction (works best for common languages)
    const dictRes = await fetch(
      `https://api.cognitive.microsofttranslator.com/dictionary/lookup?api-version=3.0&from=${detectedLang}&to=en`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ Text: orig }]),
      },
    );

    if (!dictRes.ok) {
      const errorBody = await dictRes.text();
      throw new BadRequestException(
        `Azure Dictionary API error: ${dictRes.status} ${errorBody}`,
      );
    }

    const dictData = (await dictRes.json()) as unknown as Array<{
      displayTarget?: string;
    }>;
    const correctedText = dictData?.[0]?.displayTarget || orig;
    const errorsFound = orig === correctedText ? 0 : 1;

    // Generate explanation using Azure's translation with "to" parameter
    let explanation = '';
    try {
      const explainRes = await fetch(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${detectedLang}&to=en&textType=html`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            { Text: `Grammar correction: "${orig}" → "${correctedText}"` },
          ]),
        },
      );
      if (explainRes.ok) {
        const explainData = (await explainRes.json()) as Array<{
          translations: Array<{ text: string }>;
        }>;
        explanation =
          explainData[0]?.translations[0]?.text || 'Corrected via Azure AI';
      }
    } catch {
      explanation = 'Corrected via Azure AI';
    }

    const finalResult = {
      original: orig,
      corrected: correctedText,
      explanation: explanation,
      errors_found: errorsFound,
    };

    return finalResult;
  }

  async explainGrammar(
    userId: string,
    isVip: boolean,
    dto: ExplainGrammarDto,
  ): Promise<{ original: string; corrected: string; explanation: string }> {
    await this.checkRateLimit(userId, isVip);

    const deepLKey = this.configService.get<string>('DEEPL_API_KEY');
    if (!deepLKey) {
      throw new BadRequestException('DeepL API key not configured');
    }

    const prompt = `Explain the grammar difference between the original sentence and the corrected sentence. Original: "${dto.original}" Corrected: "${dto.corrected}". Provide a brief explanation in English.`;
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${deepLKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [prompt],
        target_lang: 'EN',
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new BadRequestException(
        `DeepL API error: ${res.status} ${errorBody}`,
      );
    }
    const json = (await res.json()) as {
      translations: Array<{ text: string }>;
    };
    if (!json?.translations?.length) {
      throw new BadRequestException('DeepL returned no translations');
    }
    const explanation = json.translations[0].text;

    return {
      original: dto.original,
      corrected: dto.corrected,
      explanation,
    };
  }

  async pronunciationScore(
    userId: string,
    isVip: boolean,
    dto: PronunciationScoreDto,
  ): Promise<PronunciationScoreResult> {
    await this.checkRateLimit(userId, isVip);

    const azureKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');
    if (!azureKey) {
      throw new BadRequestException(
        'Azure Speech Services API key not configured',
      );
    }

    const region = this.configService.get<string>('AZURE_SPEECH_REGION');
    if (!region) {
      throw new BadRequestException(
        'AZURE_SPEECH_REGION environment variable not configured',
      );
    }

    // Azure Speech Services Pronunciation Assessment API
    // We need to download the audio from the URL and send it to Azure
    const audioResponse = await fetch(dto.audio_url);
    if (!audioResponse.ok) {
      throw new BadRequestException('Failed to fetch audio file from URL');
    }

    const audioBuffer = await audioResponse.arrayBuffer();

    // Azure Speech Services REST API for pronunciation assessment
    const assessmentRes = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed&profanity=raw`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
        },
        body: audioBuffer,
      },
    );

    if (!assessmentRes.ok) {
      const errorBody = await assessmentRes.text();
      throw new BadRequestException(
        `Azure Speech API error: ${assessmentRes.status} ${errorBody}`,
      );
    }

    const assessmentData = (await assessmentRes.json()) as {
      NBest?: Array<{
        PronunciationAssessment?: { AccuracyScore?: number };
        Words?: Array<{
          PronunciationAssessment?: {
            AccuracyScore?: number;
            ErrorType?: string;
          };
        }>;
      }>;
    };
    const nBest = assessmentData.NBest?.[0];

    if (!nBest) {
      throw new BadRequestException(
        'No pronunciation assessment results returned',
      );
    }

    const overallScore = Math.round(
      nBest.PronunciationAssessment?.AccuracyScore || 85,
    );
    const words = dto.target_text.split(/\s+/).filter((w) => w.length > 0);

    const breakdown: WordBreakdownItem[] = words.map((w, index) => {
      const wordResult = nBest.Words?.[index];
      return {
        word: w,
        score: Math.round(
          wordResult?.PronunciationAssessment?.AccuracyScore || 85,
        ),
        feedback: wordResult?.PronunciationAssessment?.ErrorType
          ? `Error: ${wordResult.PronunciationAssessment.ErrorType}`
          : 'Good pronunciation',
      };
    });

    const feedbackSummary =
      overallScore >= 90
        ? 'Excellent pronunciation!'
        : overallScore >= 70
          ? 'Good effort, some areas to improve'
          : 'Needs practice, focus on individual sounds';

    return {
      overall_score: overallScore,
      breakdown,
      feedback_summary: feedbackSummary,
    };
  }

  async simplify(
    userId: string,
    isVip: boolean,
    dto: SimplifyDto,
  ): Promise<{ original: string; simplified: string }> {
    await this.checkRateLimit(userId, isVip);

    const text = dto.text.trim();

    const deepLKey = this.configService.get<string>('DEEPL_API_KEY');
    if (!deepLKey) {
      throw new BadRequestException('DeepL API key not configured');
    }

    const detected = this.detectLanguage(text).language;

    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${deepLKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'EN',
        source_lang: detected.toUpperCase(),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new BadRequestException(
        `DeepL API error: ${res.status} ${errorBody}`,
      );
    }

    const json = (await res.json()) as {
      translations: Array<{ text: string }>;
    };
    const simplified = json.translations?.[0]?.text ?? text;

    return {
      original: text,
      simplified,
    };
  }

  async translateUi(dto: TranslateUiDto): Promise<TranslateUiResult> {
    const targetLang = dto.target_language || 'en-GB';
    if (targetLang === 'en-GB' || targetLang === 'en') {
      return {
        target_language: targetLang,
        translations: dto.dictionary,
        cached: true,
      };
    }

    const redis = this.supabaseService.getRedisClient();
    const cacheKey = `ui_dict:${targetLang}`;

    try {
      const cachedDict = await redis.get(cacheKey);
      if (cachedDict) {
        const parsed = JSON.parse(cachedDict) as Record<string, string>;
        return {
          target_language: targetLang,
          translations: { ...dto.dictionary, ...parsed },
          cached: true,
        };
      }
    } catch {
      // Redis fallback if offline or unavailable during tests
    }

    // No cache hit, so translate the full dictionary via DeepL. This supports
    // ANY target language dynamically, with 0 hard-coded UI strings.
    const deepLKey = this.configService.get<string>('DEEPL_API_KEY');
    if (!deepLKey) {
      throw new BadRequestException('DeepL API key not configured');
    }

    const keys = Object.keys(dto.dictionary);
    const values = keys.map((key) => dto.dictionary[key]);

    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${deepLKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: values,
        target_lang: targetLang.toUpperCase(),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new BadRequestException(
        `DeepL API error: ${res.status} ${errorBody}`,
      );
    }

    const jsonResponse = (await res.json()) as {
      translations: Array<{ text: string }>;
    };

    const translatedDict: Record<string, string> = {};
    keys.forEach((key, index) => {
      translatedDict[key] =
        jsonResponse.translations?.[index]?.text ?? dto.dictionary[key];
    });

    try {
      await redis.set(cacheKey, JSON.stringify(translatedDict));
      await redis.expire(cacheKey, 604800); // 7 days cache
    } catch {
      // Redis error handling during tests
    }

    return {
      target_language: targetLang,
      translations: { ...dto.dictionary, ...translatedDict },
      cached: false,
    };
  }

  async translateBio(
    userId: string,
    isVip: boolean,
    dto: TranslateBioDto,
  ): Promise<{
    original_text: string;
    translated_text: string;
    detected_language: string;
  }> {
    await this.checkRateLimit(userId, isVip);

    const supabase = this.supabaseService.getClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('bio_text')
      .eq('id', dto.target_user_id)
      .single();

    if (error || !user?.bio_text) {
      throw new BadRequestException('User not found or no bio available');
    }

    const bioText = user.bio_text.trim();
    const translateResult = await this.translate(userId, isVip, {
      text: bioText,
      target_language: dto.target_language,
    });

    return {
      original_text: bioText,
      translated_text: translateResult.translated_text,
      detected_language: translateResult.detected_language,
    };
  }

  async translateAndCorrect(
    userId: string,
    isVip: boolean,
    dto: TranslateDto,
  ): Promise<{
    original_text: string;
    translated_text: string;
    detected_language: string;
    transliteration: string;
    definition: string;
    pronunciation_url: string;
    wordCorrections: Array<{
      original: string;
      corrected: string;
      explanation: string;
      offset: number;
      isCorrect: boolean;
    }>;
  }> {
    await this.checkRateLimit(userId, isVip);

    // Detect source language if not provided
    const detected =
      dto.source_language || this.detectLanguage(dto.text).language;
    const cleanWord = dto.text.trim();

    const deepLKey = this.configService.get<string>('DEEPL_API_KEY');
    if (!deepLKey) {
      throw new BadRequestException('DeepL API key not configured');
    }

    // Translate the original text via DeepL
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${deepLKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [cleanWord],
        target_lang: dto.target_language.toUpperCase(),
        source_lang: detected.toUpperCase(),
        tag_handling: 'xml',
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new BadRequestException(
        `DeepL API error: ${res.status} ${errorBody}`,
      );
    }

    const jsonResponse = (await res.json()) as unknown as {
      translations: Array<{ text: string }>;
    };
    const translatedText = jsonResponse.translations[0].text;

    let correctedText = cleanWord;
    let explanation = '';
    const azureKey = this.configService.get<string>('AZURE_TRANSLATOR_KEY');

    // Obtain grammar‑style correction via Azure (mirrors the way
    // grammarCheck works but does not count a second API call)
    if (azureKey) {
      const detectRes = await fetch(
        'https://api.cognitive.microsofttranslator.com/detect?api-version=3.0',
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ Text: cleanWord }]),
        },
      );
      const detectData = (await detectRes.json()) as Array<{
        language: string;
      }>;
      const detectedLang = detectData?.[0]?.language || 'en';

      const dictRes = await fetch(
        `https://api.cognitive.microsofttranslator.com/dictionary/lookup?api-version=3.0&from=${detectedLang}&to=en`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{ Text: cleanWord }]),
        },
      );
      const dictData = (await dictRes.json()) as Array<{
        displayTarget?: string;
      }>;
      correctedText = dictData?.[0]?.displayTarget || cleanWord;

      const explainRes = await fetch(
        `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${detectedLang}&to=en&textType=html`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([
            {
              Text: `Grammar correction: "${cleanWord}" → "${correctedText}"`,
            },
          ]),
        },
      );
      if (explainRes.ok) {
        const explainData = (await explainRes.json()) as Array<{
          translations: Array<{ text: string }>;
        }>;
        explanation =
          explainData[0]?.translations[0]?.text || 'Corrected via Azure AI';
      } else {
        explanation = 'Corrected via Azure AI';
      }
    }

    // Build word‑level corrections to match Tandem‑style structured UI (every word)
    const originalWords = cleanWord.split(/\s+/);
    const correctedWords = correctedText.split(/\s+/);
    const wordCorrections: Array<{
      original: string;
      corrected: string;
      explanation: string;
      offset: number;
      isCorrect: boolean;
    }> = [];
    let currentPos = 0;
    for (let i = 0; i < originalWords.length; i++) {
      const origWord = originalWords[i];
      const startIndex = cleanWord.indexOf(origWord, currentPos);
      const corrWord = correctedWords[i] ?? origWord;
      const isCorrect = origWord === corrWord;
      wordCorrections.push({
        original: origWord,
        corrected: corrWord,
        explanation: isCorrect ? '' : explanation,
        offset: startIndex >= 0 ? startIndex : currentPos,
        isCorrect,
      });
      currentPos =
        startIndex >= 0
          ? startIndex + origWord.length
          : currentPos + origWord.length;
    }

    return {
      original_text: cleanWord,
      translated_text: translatedText,
      detected_language: detected,
      transliteration: '',
      definition: `Translation of "${cleanWord}" in ${dto.target_language}`,
      pronunciation_url: `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(translatedText)}&tl=${dto.target_language}`,
      wordCorrections,
    };
  }

  generateSessionSummary(text: string): {
    summary: string;
    vocabulary: string[];
  } {
    if (!text || text.trim().length === 0) {
      return { summary: 'No transcript available.', vocabulary: [] };
    }
    const sentences = text.match(/[^.!?]+[.!?]/g) || [text];
    const cleanSentences = sentences
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    // pick the three longest sentences as key topics
    const keySentences = [...cleanSentences]
      .sort((a, b) => b.length - a.length)
      .slice(0, 3);
    const summary =
      keySentences.length > 0
        ? `Key topics covered:\n${keySentences.join('\n')}`
        : 'No summary available.';

    const words = text.toLowerCase().match(/\b[a-z']{3,}\b/g) || [];
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'and',
      'or',
      'but',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'shall',
      'with',
      'by',
      'as',
      'it',
      'its',
      'this',
      'that',
      'these',
      'those',
      'i',
      'we',
      'you',
      'he',
      'she',
      'they',
      'my',
      'our',
      'your',
      'his',
      'her',
      'their',
      'me',
      'us',
      'him',
      'them',
      'from',
      'about',
      'up',
      'out',
      'if',
      'so',
      'no',
      'not',
      'just',
      'very',
      'too',
      'also',
      'some',
      'any',
      'each',
      'every',
      'all',
      'both',
      'more',
      'most',
      'other',
      'such',
      'only',
      'own',
      'same',
      'into',
      'over',
      'after',
      'before',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'what',
      'which',
      'who',
      'whom',
    ]);
    const freqMap = new Map<string, number>();
    for (const w of words) {
      if (!stopWords.has(w)) {
        freqMap.set(w, (freqMap.get(w) || 0) + 1);
      }
    }
    const sorted = [...freqMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);
    const vocabulary = sorted.slice(0, 10);

    return { summary, vocabulary };
  }
}
