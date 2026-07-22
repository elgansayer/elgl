import { Injectable, signal, effect } from '@angular/core';

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isRtl: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  readonly currentLang = signal<string>('en-GB');

  readonly availableLanguages: LanguageInfo[] = [
    { code: 'en-GB', name: 'British English', nativeName: 'English (UK)', flag: '🇬🇧', isRtl: false },
    { code: 'en-US', name: 'American English', nativeName: 'English (US)', flag: '🇺🇸', isRtl: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', isRtl: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', isRtl: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRtl: false },
    { code: 'zh', name: 'Mandarin Chinese', nativeName: '中文 (简体)', flag: '🇨🇳', isRtl: false },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', isRtl: true },
    { code: 'fa', name: 'Persian', nativeName: 'פארסי / فارسی', flag: '🇮🇷', isRtl: true },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', isRtl: false },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', isRtl: false },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', isRtl: false },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', isRtl: false },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', isRtl: false },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', isRtl: false },
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪', isRtl: false },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', isRtl: false },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', isRtl: false },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', isRtl: false },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', isRtl: false },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', isRtl: false },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', isRtl: true },
  ];

  readonly baseDictionary: Record<string, string> = {
    // Top App Navigation & Header
    'app.title': 'HelloTalk',
    'app.badgeOpenCore': 'Open-Core',
    'nav.discover': '🌍 Discover',
    'nav.moments': '🌐 Moments',
    'nav.liveRooms': '🎙️ Live Rooms',
    'nav.chatRoom': '💬 Chat Room',
    'nav.lingqReader': '📚 LingQ Reader',
    'nav.favourites': '⭐ Favourites',
    'nav.developerApi': '⚡ Developer API',
    'nav.profile': '👤 Profile',
    'common.coinsBalance': '{{coins}} Coins',
    'common.vipDevLabel': '20 UKP / $26 USD Dev VIP',
    'common.vipStdLabel': '8 UKP / $10 USD VIP',
    'common.signOut': 'Sign out',
    'common.demoActive': 'Demo / Mock Auth Active',
    'gift.broadcastTitle': '{{giftName}} Broadcast!',
    'gift.broadcastDesc': '🎉 {{sender}} gifted {{receiver}} a {{giftName}}! (🪙 {{cost}} Coins)',

    // Language Selector & Header
    'lang.label': 'Language',
    'lang.selectTitle': 'Select App Language (Any Language)',
    'lang.customPlaceholder': 'Enter ISO code e.g. sv, th, id...',
    'lang.applyCustom': 'Switch Language',

    // Discovery Component
    'discovery.title': 'Community Discovery',
    'discovery.subtitle': 'Connect with native speakers and language exchange partners nearby or across the globe.',
    'discovery.filterAll': 'All Users',
    'discovery.filterNearMe': 'Near Me (Radius)',
    'discovery.filterSerious': 'Serious Learners Only',
    'discovery.radiusLabel': 'Maximum Distance: {{radius}} km',
    'discovery.vipRadiusNote': 'VIP users (8 UKP / $10 USD) get global discovery and location spoofing.',
    'discovery.searchPlaceholder': 'Search by name, language, or bio...',
    'discovery.emptyState': 'No language partners matched your current filter criteria.',
    'discovery.streakDays': '🔥 {{days}}d Streak',
    'discovery.ratio': '✨ {{ratio}}% Corrections',
    'discovery.native': 'Native: {{lang}}',
    'discovery.learning': 'Learning: {{lang}}',
    'discovery.startChat': 'Start Exchange Chat',
    'discovery.viewProfile': 'View Profile',

    // Moments Feed Component
    'moments.title': 'Global Language Moments',
    'moments.subtitle': 'Share daily updates, voice recordings, and get corrections from native speakers.',
    'moments.createBtn': '+ Post Moment',
    'moments.tabAll': 'All Moments',
    'moments.tabClassmates': 'Classmates (Same Language)',
    'moments.tabFollowing': 'Following',
    'moments.postPlaceholder': 'What are you practicing or learning right now?',
    'moments.recordVoice': 'Record Voice Clip (up to 60s)',
    'moments.attachImages': 'Attach Images (up to 9)',
    'moments.publishBtn': 'Publish Moment',
    'moments.likeBtn': 'Like ({{count}})',
    'moments.commentBtn': 'Comment ({{count}})',
    'moments.pinBtn': 'Pin to Top (VIP)',
    'moments.translateBtn': 'Translate Moment',
    'moments.listenBtn': 'Listen (TTS)',

    // Audio Room Component
    'audioRoom.title': 'Live Language Practice Rooms',
    'audioRoom.subtitle': 'Join WebRTC audio & video stages with native speakers around the world.',
    'audioRoom.createRoomBtn': '+ Create Audio Room',
    'audioRoom.roomTitleInput': 'Room Title e.g. Advanced English Conversation...',
    'audioRoom.hostStage': '🎙️ Stage Hosts & Speakers',
    'audioRoom.audienceGrid': '👥 Audience & Listeners',
    'audioRoom.raiseHand': '✋ Raise Hand to Speak',
    'audioRoom.handRaised': '⏳ Hand Raised (Waiting)',
    'audioRoom.leaveRoom': '🚪 Leave Room',
    'audioRoom.muteMic': '🔇 Mute Microphone',
    'audioRoom.unmuteMic': '🔊 Unmute Microphone',
    'audioRoom.tipHost': '🎁 Tip Host 50 Coins',
    'audioRoom.closedCaptions': '📝 Live AI Speech-to-Text Subtitles',

    // Chat Room Component
    'chatRoom.title': 'Language Exchange Chat',
    'chatRoom.typePlaceholder': 'Type your message in British English or any language...',
    'chatRoom.sendBtn': 'Send Message',
    'chatRoom.grammarCheckBtn': '✨ AI Grammar Check',
    'chatRoom.recordVoiceNote': '🎙️ Hold to Record Voice Note',
    'chatRoom.doodleBtn': '🎨 Draw Doodle',
    'chatRoom.correctMsgBtn': '✏️ Correct Sentence',
    'chatRoom.favouriteBtn': '⭐ Bookmark & Save',
    'chatRoom.searchMessages': 'Search messages inside room...',

    // LingQ Reader & Vocabulary Dashboard
    'lingq.title': 'LingQ Tokenised Interactive Reader',
    'lingq.subtitle': 'Click any word to translate, listen to pronunciation, and track with spaced repetition.',
    'lingq.sampleArticleTitle': 'The Benefits of Bilingualism and Language Exchange',
    'lingq.srsLevelBlue': 'New Word (0)',
    'lingq.srsLevelYellow': 'Learning (1-3)',
    'lingq.srsLevelWhite': 'Known / Mastered (4)',
    'vocabulary.title': 'SRS Vocabulary Dashboard',
    'vocabulary.subtitle': 'Review your saved flashcards with spaced repetition grading.',
    'vocabulary.flipCard': 'Flip Flashcard',
    'vocabulary.gradeAgain': 'Again (Level 0)',
    'vocabulary.gradeHard': 'Hard (Level 1)',
    'vocabulary.gradeGood': 'Good (Level 2)',
    'vocabulary.gradeEasy': 'Easy (Level 3+)',

    // Favourites Component
    'favourites.title': 'Saved Bookmarks & Corrections',
    'favourites.subtitle': 'Review important vocabulary and native speaker corrections you bookmarked.',
    'favourites.emptyState': 'No bookmarked messages yet. Click ⭐ inside any chat or moment to save!',

    // Developer Dashboard Component
    'developer.title': 'Developer API Dashboard',
    'developer.subtitle': 'Manage your API keys and inspect real-time webhook analytics.',
    'developer.tierLabel': 'Developer VIP Plan: 20 UKP / $26 USD per month',
    'developer.generateKey': 'Generate New API Key',
    'developer.docsLink': 'View REST & WebSocket API Documentation',

    // Profile Component & Visitor Logs
    'profile.title': 'Your Language Profile',
    'profile.editBio': 'Edit Profile Biography',
    'profile.nativeLang': 'Native Language',
    'profile.targetLangs': 'Target Learning Languages (Up to 3 for VIP)',
    'profile.upgradeVipBanner': 'Upgrade to VIP for 8 UKP / $10 USD per month (or 6 UKP / $8 USD annual equivalent) to unlock unlimited AI, location spoofing, and incognito mode!',
    'profile.streakBadge': 'Study Streak: {{days}} Days',
    'profile.correctionRatioBadge': 'Community Correction Ratio: {{ratio}}%',
    'visitors.title': 'Who Viewed Your Profile',
    'visitors.subtitle': 'Recent visitors to your profile over the past 30 days.',
    'visitors.blurredName': 'Visitor Blurred (Free Tier)',
    'visitors.upgradePrompt': 'Upgrade to VIP (8 UKP / $10 USD per month) to unblur visitor names and see exact timestamps!',

    // Modals & Utilities
    'wordModal.definition': 'Dictionary Definition',
    'wordModal.transliteration': 'Phonetic Transliteration',
    'wordModal.listenPronunciation': '🔊 Listen to Audio Pronunciation',
    'wordModal.saveToFlashcards': '+ Save to Flashcards (SRS)',
    'safety.reportTitle': 'Report or Block User',
    'safety.reasonPlaceholder': 'Please describe the safety or conduct concern...',
    'safety.submitReport': 'Submit Report to Moderation Team',
    'safety.blockUser': 'Block User Immediately',
    'giftModal.title': 'Send Animated Virtual Gift',
    'giftModal.subtitle': 'Support your language partner or stage host with virtual coins.',
    'giftModal.sendGiftBtn': 'Send {{giftName}} ({{cost}} Coins)',
  };

  readonly translations = signal<Record<string, string>>({ ...this.baseDictionary });

  constructor() {
    this.initLanguageFromStorage();

    effect(() => {
      const lang = this.currentLang();
      this.applyDocumentRtlAndLocale(lang);
    });
  }

  private initLanguageFromStorage(): void {
    if (typeof localStorage !== 'undefined') {
      const savedLang = localStorage.getItem('hellotalk_locale');
      if (savedLang) {
        this.setLanguage(savedLang);
      } else {
        this.applyDocumentRtlAndLocale('en-GB');
      }
    }
  }

  private applyDocumentRtlAndLocale(lang: string): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
      const isRtlLang = ['ar', 'he', 'fa', 'ur'].includes(lang.toLowerCase());
      document.documentElement.dir = isRtlLang ? 'rtl' : 'ltr';
    }
  }

  async setLanguage(langCode: string): Promise<void> {
    const code = langCode.trim();
    if (!code) return;

    this.currentLang.set(code);
    this.applyDocumentRtlAndLocale(code);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hellotalk_locale', code);
    }

    if (code === 'en-GB' || code === 'en' || code === 'en-US') {
      this.translations.set({ ...this.baseDictionary });
      return;
    }

    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(`hellotalk_dict_${code}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.translations.set({ ...this.baseDictionary, ...parsed });
          return;
        } catch {
          // ignore cache parse errors
        }
      }
    }

    // Call backend dynamic ANY-language translation API
    try {
      const response = await fetch('/api/nlp/translate-ui', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_language: code,
          dictionary: this.baseDictionary,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.translations) {
          const merged = { ...this.baseDictionary, ...data.translations };
          this.translations.set(merged);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`hellotalk_dict_${code}`, JSON.stringify(merged));
          }
        }
      }
    } catch {
      // In offline / test environments, fallback to base dictionary or algorithmic keys
    }
  }

  translate(key: string, params?: Record<string, unknown>): string {
    const dict = this.translations();
    let text = dict[key] || this.baseDictionary[key] || key;

    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramVal));
      }
    }

    return text;
  }
}
