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
    {
      code: 'en-GB',
      name: 'British English',
      nativeName: 'English (UK)',
      flag: '🇬🇧',
      isRtl: false,
    },
    {
      code: 'en-US',
      name: 'American English',
      nativeName: 'English (US)',
      flag: '🇺🇸',
      isRtl: false,
    },
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

  private readonly baseDictionary: Record<string, string> = {
    // Top App Navigation & Header
    'app.title': 'HelloTalk',
    'app.badgeOpenCore': 'Community clone',
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Mark all read',
    'notifications.tabAll': 'All',
    'notifications.tabLikes': 'Likes',
    'notifications.tabComments': 'Comments',
    'notifications.tabFollows': 'Followers',
    'notifications.emptyTitle': 'No notifications yet',
    'notifications.emptySubtitle':
      'When partners interact with your profile or posts, you will see alerts here.',
    'notifications.likedProfile': 'liked your profile',
    'notifications.likedMoment': 'liked your moment',
    'notifications.commentedMoment': 'commented on your moment',
    'notifications.repliedComment': 'replied to your comment',
    'notifications.followedYou': 'started following you',
    'notifications.viewedProfile': 'viewed your profile',
    'notifications.newActivity': 'new activity alert',
    'nav.discover': '🌍 Discover',
    'nav.moments': 'Moments',
    'nav.partners': 'Partners',
    'nav.chats': 'Chats',
    'nav.live': 'Live',
    'app.navMe': 'Me',

    // Common Fallbacks
    'common.unknownUser': 'Unknown User',
    'common.unknownSender': 'Unknown',
    'common.languagePartner': 'Language Partner',
    'nav.helloTalk': '💬 HelloTalk',
    'nav.connect': '🌍 Connect',
    'nav.liveRooms': '🎙️ Live Rooms',
    'nav.chatRoom': '💬 Chat Room',
    'nav.lingqReader': '📚 LingQ Reader',
    'nav.favourites': '⭐ Favourites',
    'nav.developerApi': '⚡ Developer API',
    'nav.profile': '👤 Me',
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
    'lang.selectLanguage': 'Select a language',
    'lang.searchPlaceholder': 'Search languages...',
    'lang.selectPlaceholder': 'Select language',
    'lang.customPlaceholder': 'Enter ISO code e.g. sv, th, id...',
    'lang.applyCustom': 'Switch Language',
    'lang.anyNative': 'Any native language',
    'lang.anyTarget': 'Any target language',
    'lang.en': 'English',
    'lang.es': 'Spanish',
    'lang.fr': 'French',
    'lang.de': 'German',
    'lang.it': 'Italian',
    'lang.pt': 'Portuguese',
    'lang.ja': 'Japanese',
    'lang.ko': 'Korean',
    'lang.zh': 'Chinese',
    'lang.ar': 'Arabic',
    'lang.ru': 'Russian',
    'lang.hi': 'Hindi',
    'lang.tr': 'Turkish',

    // Discovery Component
    'discovery.title': 'Find partners',
    'discovery.subtitle': 'Filter learners by language goals and learning style.',
    'discovery.badge': '🔎 Discovery',
    'discovery.chipGlobal': '🌍 Global partners',
    'discovery.chipStreaks': '🔥 Active streaks',
    'discovery.chipCorrections': '✅ Correction-friendly',
    'discovery.distancePref': 'Distance preference',
    'discovery.nativeLang': 'Native language',
    'discovery.targetLang': 'Target language',
    'discovery.seriousOnly': 'Serious learners only',
    'discovery.on': 'On',
    'discovery.off': 'Off',
    'discovery.resetFilters': 'Reset filters',
    'discovery.searching': 'Searching partners...',
    'discovery.noMatches': 'No partner matches yet.',
    'discovery.tryBroadening': 'Try broadening distance or language filters.',
    'discovery.matchCount': '{{count}} partner match(es)',
    'discovery.partnerFallback': 'Language partner',
    'discovery.vipBadge': 'VIP',
    'discovery.startChat': 'Start chat',
    'discovery.noBio': 'No profile bio yet.',
    'discovery.streakBadge': '🔥 {{days}}d streak',
    'discovery.correctionBadge': '✅ {{ratio}}x corrections',
    'discovery.filterAll': 'All Users',
    'discovery.filterNearMe': 'Near Me (Radius)',
    'discovery.filterSerious': 'Serious Learners Only',
    'discovery.radiusLabel': 'Maximum Distance: {{radius}} km',
    'discovery.vipRadiusNote':
      'VIP users (8 UKP / $10 USD) get global discovery and location spoofing.',
    'discovery.searchPlaceholder': 'Search by name, language, or bio...',
    'discovery.emptyState': 'No language partners matched your current filter criteria.',
    'discovery.streakDays': '🔥 {{days}}d Streak',
    'discovery.ratio': '✨ {{ratio}}% Corrections',
    'discovery.native': 'Native: {{lang}}',
    'discovery.learning': 'Learning: {{lang}}',
    'discovery.viewProfile': 'View Profile',
    'discovery.langAny': 'Any',
    'discovery.langJapanese': 'Japanese',
    'discovery.langKorean': 'Korean',
    'discovery.langNorwegian': 'Norwegian',
    'discovery.bannerPaid': 'Unlock Paid Practice',
    'discovery.bannerDesc': 'Get 1-on-1 native practice',
    'discovery.bannerView': 'View VIP',
    'discovery.partnerBioFallback':
      'I want to improve my language skills! Let us practice together.',

    // Moments Feed Component
    'moments.title': 'Moments',
    'moments.subtitle': 'Share, correct, and learn in public.',
    'moments.visitorsLink': '👀 Visitors',
    'moments.tabAll': 'All',
    'moments.tabClassmates': 'Classmates',
    'moments.tabFollowing': 'Following',
    'moments.chipPublic': '🌍 Public exchange',
    'moments.chipCorrections': '✏️ Native corrections',
    'moments.chipLingq': '📚 LingQ saving',
    'moments.postPlaceholder': 'Share what you are practising today...',
    'moments.imageUrlPlaceholder': 'Image URL',
    'moments.addImageBtn': 'Add image',
    'moments.addVoiceBtn': 'Add voice',
    'moments.postingBtn': 'Posting...',
    'moments.postBtn': 'Post moment',
    'moments.loading': 'Loading moments...',
    'moments.empty': 'No moments yet in this feed.',
    'moments.pinnedBanner': 'Pinned moment (VIP 8 UKP / $10 USD)',
    'moments.memberFallback': 'Member',
    'moments.pinBtn': 'Pin',
    'moments.unpinBtn': 'Unpin',
    'moments.likeBtn': 'Like',
    'moments.commentBtn': 'Comment',
    'moments.replyBtn': 'Reply',
    'moments.correctBtn': 'Correct',
    'moments.quoteBtn': 'Quote',
    'moments.correctSentenceTitle': 'Correct Sentence',
    'moments.ghostOriginal': 'Original Text (Ghost)',
    'moments.resetGhost': 'Reset',
    'moments.liveDiffPreview': 'Live Diff Preview',
    'moments.quotedTextAlert': 'Quoted sentence in comment.',
    'moments.correctionSentAlert': 'Correction published to timeline.',
    'common.optional': 'optional',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.loadError': 'Failed to load data',
    'moments.showMore': 'Show more',
    'moments.showLess': 'Show less',
    'moments.translate': 'Translate',
    'moments.hideTranslation': 'Hide translation',
    'moments.copyText': 'Copy text',
    'moments.saveSentence': 'Save sentence',
    'moments.normalComment': 'Normal comment',
    'moments.correctionMode': 'Correction mode',
    'moments.commentPlaceholder': 'Write a comment',
    'moments.postCommentBtn': 'Post',
    'moments.originalSentence': 'Original sentence',
    'moments.correctedSentence': 'Corrected sentence',
    'moments.explanation': 'Explanation',
    'moments.sendCorrection': 'Send correction',
    'moments.maxMediaAlert': 'You may upload a maximum of 9 media items per Moment.',
    'moments.publishError': 'Failed to publish Moment.',
    'moments.savedLingqAlert': '📚 Saved Moment text to your LingQ SRS Learning Deck:\n"{{text}}"',
    'moments.saveErrorAlert': 'Failed to save or already in your SRS deck.',
    'moments.copiedAlert': 'Moment text copied.',
    'moments.copyErrorAlert': 'Could not copy text right now.',
    'moments.transError': 'Could not fetch translation right now.',
    'moments.likedBy': 'Liked by',
    'moments.noLikesYet': 'No likes yet',

    // Audio Room Component
    'audioRoom.liveSfuBadge': '🔴 Live SFU room',
    'audioRoom.hostLabel': 'Host',
    'audioRoom.hostFallback': 'Room Host',
    'audioRoom.listenersCount': '{{count}} listening',
    'audioRoom.raiseHandBtn': '✋ Raise hand',
    'audioRoom.giftHostBtn': '🎁 Gift host',
    'audioRoom.moderateBtn': '🛡️ Moderate',
    'audioRoom.endArchiveBtn': '💾 End and archive',
    'audioRoom.leaveBtn': '👋 Leave',
    'audioRoom.chipListening': '🎧 Live listening',
    'audioRoom.chipQueue': '✋ Raise hand queue',
    'audioRoom.chipSubtitles': '💬 Synchronised subtitles',
    'audioRoom.speakerStage': '🎙️ Speaker stage',
    'audioRoom.speakerCount': '{{count}} speaker(s)',
    'audioRoom.speakerPrefix': 'Speaker {{id}}',
    'audioRoom.muteBtn': 'Mute',
    'audioRoom.demoteBtn': 'Demote',
    'audioRoom.raisedHandsTitle': '✋ Raised hands',
    'audioRoom.learnerAccess': 'Learner {{id}}... wants stage access',
    'audioRoom.approveBtn': 'Approve',
    'audioRoom.listenerAudience': '🎧 Listener audience',
    'audioRoom.memberPrefix': '🎧 Member #{{num}}',
    'audioRoom.roomsTitle': '🎙️ Live audio and video rooms',
    'audioRoom.roomsSubtitle':
      'Join language rooms, raise your hand to speak, or launch your own room.',
    'audioRoom.launchRoomBtn': '+ Launch live room',
    'audioRoom.chipExchange': '🌍 Language exchange',
    'audioRoom.chipStages': '🔴 Host-led stages',
    'audioRoom.chipModeration': '🛡️ Safety moderation',
    'audioRoom.loading': 'Loading live rooms...',
    'audioRoom.noActiveRooms': 'No active rooms right now',
    'audioRoom.beFirst': 'Be first to launch one.',
    'audioRoom.liveTag': '🔴 Live',
    'audioRoom.joinRoomBtn': 'Join room',
    'audioRoom.modalTitle': '🎙️ Launch live language room',
    'audioRoom.modalSubtitle': 'Start a hosted room powered by LiveKit SFU.',
    'audioRoom.roomTitleLabel': 'Room title',
    'audioRoom.roomTitlePlaceholder': 'Conversation practice room',
    'audioRoom.targetLangLabel': 'Target language',
    'audioRoom.languagePairLabel': 'Language pair',
    'audioRoom.topicLabel': 'Topic',
    'audioRoom.topic.Pronunciation': 'Pronunciation',
    'audioRoom.topic.Beginners': 'Beginners',
    'audioRoom.topic.CulturalExchange': 'Cultural Exchange',
    'audioRoom.topic.GrammarHelp': 'Grammar Help',
    'audioRoom.topic.FreeTalk': 'Free Talk',
    'audioRoom.topic.BusinessEnglish': 'Business English',
    'audioRoom.videoStreamLabel': 'Enable split-screen video',
    'audioRoom.cancelBtn': 'Cancel',
    'audioRoom.launchStageBtn': 'Launch stage',
    'audioRoom.archiveConfirm':
      'Are you sure you want to end this room and archive the recording to Cloudflare R2?',
    'audioRoom.launchError': 'Failed to launch audio room.',
    'audioRoom.joinError': 'Could not join room right now.',
    'audioRoom.inviteCoHostBtn': '🎥 Invite co-host',
    'audioRoom.inviteCoHostError': 'Could not invite co-host right now.',
    'audioRoom.removeCoHostBtn': 'Remove co-host',
    'audioRoom.removeCoHostError': 'Could not remove co-host right now.',
    'audioRoom.coHostPromotedToast': '🎉 The host invited you to co-host with live video!',
    'audioRoom.coHostRemovedToast': 'The host ended your co-host video session.',
    'audioRoom.speakerApprovedToast':
      '🎉 Host approved your request to speak! Your microphone is now live on stage.',
    'audioRoom.speakerDemotedToast': 'The host moved you back to the listener audience.',
    'audioRoom.roomEndedToast':
      'This audio/video room has ended and been archived to Cloudflare R2.',
    'audioRoom.raiseHandToast':
      '✋ Hand raised! The host has been notified of your request to speak on stage.',

    // Video Room Component (split-screen co-host video layout)
    'videoRoom.hostBadge': 'Host',
    'videoRoom.coHostBadge': 'Co-Host',
    'videoRoom.waitingForHost': 'Waiting for host video...',
    'videoRoom.waitingForCoHost': 'Waiting for co-host to join...',
    'videoRoom.removeCoHostAria': 'Remove co-host from split screen',
    'videoRoom.noEligibleSpeakers': 'Approve a stage speaker before inviting a co-host.',

    // Chat Room Component
    'chatRoom.liveNow': 'Live now',
    'chatRoom.connecting': 'Connecting...',
    'chatRoom.searchPlaceholder': 'Search messages',
    'chatRoom.searchBtn': 'Search',
    'chatRoom.loading': 'Loading messages...',
    'chatRoom.empty': 'No messages yet.',
    'chatRoom.partnerFallback': 'Partner',
    'chatRoom.saveBtn': 'Save',
    'chatRoom.favBtn': 'Fav',
    'chatRoom.typing': 'Someone is typing...',
    'chatRoom.originalPlaceholder': 'Original sentence',
    'chatRoom.correctedPlaceholder': 'Corrected sentence',
    'chatRoom.explanationPlaceholder': 'Explanation',
    'chatRoom.cancelBtn': 'Cancel',
    'chatRoom.sendCorrectionBtn': 'Send correction',
    'chatRoom.correctBtn': 'Correct',
    'chatRoom.doodleBtn': 'Doodle',
    'chatRoom.voiceBtn': 'Voice',
    'chatRoom.typePlaceholder': 'Type your message',
    'chatRoom.sendBtn': 'Send',
    'chatRoom.bookmarkSuccess': 'Message bookmarked to Favourites!',
    'chatRoom.bookmarkError': 'Already bookmarked or failed.',
    'chatRoom.savedLingqAlert': '📚 Saved sentence to your LingQ SRS Learning Deck:\n"{{text}}"',
    'chatRoom.saveLingqError': 'Failed to save sentence or already in your SRS deck.',

    // Chat List Component
    'chatList.title': 'Chats',
    'chatList.subtitle': 'Messages, corrections, and instant language exchange.',
    'chatList.openFirstBtn': '+ Open first room',
    'chatList.searchPlaceholder': 'Search chats',
    'chatList.loading': 'Loading conversations...',
    'chatList.empty': 'No active conversations. Find partners to start chatting!',
    'chatList.tapToChat': 'Tap to chat...',
    'chatList.pinnedSection': 'Pinned chats',
    'chatList.allSection': 'All chats',
    'chat.incomingCallTitle': 'Incoming Call',
    'chatList.noMessages': 'No messages yet. Start a chat.',
    'chatList.textMessage': 'Text message',
    'chatList.sentCorrection': 'Sent a correction',
    'chatList.sentVoice': 'Sent a voice note',
    'chatList.sentDoodle': 'Sent a doodle',
    'chatList.topTitle': 'Language Talks',
    'chatList.quickCourses': 'All Courses',
    'chatList.quickPlay': 'Play',
    'chatList.quickAiTrans': 'AI Translation',
    'chatList.quickJpAi': 'Japanese Ai',
    'chatList.quickMore': 'More',
    'chatList.filterAll': 'All',
    'chatList.filterOnline': 'Online',
    'chatList.filterUnread': 'Unread',
    'chatList.filterMyTurn': 'My turn',
    'chatList.filterTimezone': 'Timezone proximity',

    // LingQ & Vocabulary Studio
    'vocabulary.title': '📚 Vocabulary studio',
    'vocabulary.subtitle':
      'Spaced repetition, word decks, grammar coaching, and pronunciation scoring.',
    'vocabulary.tabReview': '🎯 Review ({{count}})',
    'vocabulary.tabDeck': '📖 Deck ({{count}})',
    'vocabulary.tabAi': '🤖 AI practice',
    'vocabulary.chipRecall': '📚 SRS recall',
    'vocabulary.chipGrammar': '✏️ Grammar AI',
    'vocabulary.chipPronunciation': '🎙️ Pronunciation AI',
    'vocabulary.noDue': 'No review cards are due right now.',
    'vocabulary.cardCounter': 'Card {{current}} of {{total}}',
    'vocabulary.levelBadge': 'Level {{level}}/4',
    'vocabulary.tapToFlip': 'Tap to flip',
    'vocabulary.againBtn': 'Again',
    'vocabulary.goodBtn': 'Good',
    'vocabulary.knownBtn': 'Known',
    'vocabulary.noSaved': 'No saved words yet.',
    'vocabulary.nextReview': 'Next review: {{date}}',
    'vocabulary.aiBannerTitle': '🤖 AI grammar and pronunciation',
    'vocabulary.aiBannerDesc':
      'Free usage is capped daily. VIP unlocks full access for 8 UKP / $10 USD per month.',
    'vocabulary.practiceLabel': 'Practice sentence',
    'vocabulary.practicePlaceholder': 'Enter sentence to evaluate',
    'vocabulary.checkGrammarBtn': '✏️ Check grammar',
    'vocabulary.scorePronunciationBtn': '🎙️ Score pronunciation',
    'vocabulary.grammarTitle': 'Grammar analysis ({{count}} issue(s))',
    'vocabulary.originalLabel': 'Original: ',
    'vocabulary.correctedLabel': 'Corrected: ',
    'vocabulary.pronunciationScore': 'Pronunciation score: {{score}} / 100',
    'profile.playAudioIntro': 'Play Introduction',

    // User Detail Component
    'userProfile.notFound': 'User not found.',
    'userProfile.loadError': 'Failed to load profile. Please try again.',
    'userProfile.follow': 'Follow',
    'userProfile.following': 'Following',

    // Favourites Component
    'favourites.title': 'Favourites',
    'favourites.subtitle': 'Saved chat highlights for spaced revision.',
    'favourites.chipPhrases': '📌 Important phrases',
    'favourites.chipCorrections': '✏️ Corrections',
    'favourites.chipQueue': '📚 Review queue',
    'favourites.loading': 'Loading favourites...',
    'favourites.empty': 'No favourites saved yet.',
    'favourites.partnerFallback': 'Language partner',

    // Developer Dashboard Component
    'developer.bannerTier': '⚡ Developer tier & AI Sandbox',
    'developer.bannerActive': 'Active: 20 UKP / $26 USD monthly',
    'developer.bannerTitle': 'Programmatic API & Diagnostics Platform',
    'developer.bannerSubtitle':
      'Inspect PostGIS spatial queries, Centrifugo real-time fan-out, and LiveKit WebRTC stage permissions in real time.',
    'developer.upgradeDevBtn': 'Upgrade developer tier (20 UKP / $26 USD)',
    'developer.upgradeConsumerBtn': 'Consumer VIP (8 UKP / $10 USD)',
    'developer.tabOverview': '📊 Telemetry Overview',
    'developer.tabPostgis': '🗺️ PostGIS Spatial Sandbox',
    'developer.tabCentrifugo': '⚡ Centrifugo & Redis Fan-Out',
    'developer.tabLivekit': '🎙️ LiveKit SFU Stage Simulator',
    'developer.apiKeyTitle': '🔐 API key management',
    'developer.apiKeySubtitle': 'Send key in Authorization header.',
    'developer.generateBtn': '+ Generate key',
    'developer.activeKeyLabel': 'Active production key',
    'developer.activeRpm': 'Active (600 RPM)',
    'developer.noKey': 'No API key yet. Activate developer tier and generate one.',
    'developer.statCallsLabel': 'Total API calls today',
    'developer.statCallsSub': 'Across NLP, moments, and live rooms.',
    'developer.statRateLabel': 'Rate limit',
    'developer.statRate600': '600 RPM',
    'developer.statRate60': '60 RPM',
    'developer.statRateSub': 'Tier: {{tier}}',
    'developer.statLatencyLabel': 'Average latency',
    'developer.statLatencySub': 'P95 baseline: 28 ms',
    'developer.postgisTitle': '🗺️ PostGIS Geography Query Simulator (ST_DWithin)',
    'developer.postgisSubtitle':
      'Simulate spatial indexing calculations and VIP location spoofing without modifying production data.',
    'developer.latLabel': 'Search Latitude (SRID 4326)',
    'developer.lngLabel': 'Search Longitude (SRID 4326)',
    'developer.radiusLabel': 'Radius (Metres): {{radius}}m',
    'developer.spoofCheckbox':
      'Enable VIP mock location spoofing override (8 UKP / $10 USD feature)',
    'developer.executeBtn': '🔍 Execute Spatial Query',
    'developer.executingBtn': '⏳ Executing...',
    'developer.queryResults': 'Query Results: {{count}} matching learners',
    'developer.distanceAway': '{{distance}}m away',
    'developer.nearPoint': 'Near point',
    'developer.noResults':
      'No spatial results generated yet. Click "Execute Spatial Query" to test index.',
    'developer.centrifugoTitle': '⚡ Centrifugo v5 & Redis 7 Fan-Out Diagnostics',
    'developer.centrifugoSubtitle':
      'Inspect real-time WebSocket connection signals and simulated Redis queue broadcasts.',
    'developer.statusPrefix': 'Status: {{status}}',
    'developer.disconnectBtn': 'Disconnect',
    'developer.connectBtn': 'Connect WebSocket',
    'developer.redisTitle': 'Redis Timeline Queue Fan-Out Simulation',
    'developer.redisDesc':
      'When a user publishes a Moment, TimelineWorker executes RPUSH timeline_queue:[id] to distribute IDs to all subscribers asynchronously.',
    'developer.triggerRedisBtn': '🚀 Trigger Simulated Redis Fan-Out (RPUSH)',
    'developer.livekitTitle': '🎙️ LiveKit WebRTC SFU Stage Permissions (RoomServiceClient)',
    'developer.livekitSubtitle':
      'Simulate stage hand-raising workflows and token canPublish claims inside live audio/video rooms.',
    'developer.simRoleLabel': 'Simulated Stage Role',
    'developer.permLabel': 'Publish Permission (canPublish JWT Claim): ',
    'developer.permGranted': 'GRANTED (Microphone ON)',
    'developer.permRestricted': 'RESTRICTED (Listener only)',
    'developer.simApproveBtn': '✋ Simulate Host Approval (canPublish: true)',
    'developer.simDemoteBtn': '⬇️ Demote to Audience (canPublish: false)',
    'developer.recordingTitle': 'Composite Recording Engine',
    'developer.recordingActive': '🔴 RECORDING ACTIVE',
    'developer.recordingIdle': '⚪ IDLE',
    'developer.recordingDesc':
      'Archive live stage audio/video composites directly to Cloudflare R2 bucket with zero egress fees.',
    'developer.stopRecordingBtn': '⏹️ Stop & Save R2 Archive',
    'developer.startRecordingBtn': '🔴 Start Composite Recording',
    'developer.logsTitle': '🛡️ Live Architectural Diagnostics Stream',
    'developer.showingLogs': 'Showing last {{count}} events',

    // Profile Component & Visitor Logs
    'profile.title': 'Your Language Profile',
    'profile.loading': 'Loading profile...',
    'profile.learnerFallback': 'Language learner',
    'profile.joined': 'Joined {{date}}',
    'profile.vipBadge': 'VIP',
    'profile.visitorsBtn': 'Visitors',
    'profile.audioIntroBtn': 'Audio intro',
    'profile.editBtn': 'Edit profile',
    'profile.cancelBtn': 'Cancel',
    'profile.nativeLabel': 'Native',
    'profile.targetLabel': 'Target',
    'profile.streakLabel': 'Streak',
    'profile.correctionsLabel': 'Corrections',
    'profile.streakValue': '🔥 {{days}}d',
    'profile.correctionValue': '{{ratio}}x',
    'profile.favLink': '⭐ Favourites',
    'profile.vocabLink': '📚 Vocabulary',
    'profile.liveRoomsLink': '🎙️ Live rooms',
    'profile.devLink': '⚡ Developer',
    'profile.chipSafety': '🛡️ Safety controls',
    'profile.chipPrivacy': '🔐 Privacy-first profile',
    'profile.chipMatching': '🌐 Exchange matching',
    'profile.upgradeTitle': 'Upgrade for full visitor identities and advanced features',
    'profile.upgradePrice': '8 UKP / $10 USD per month',
    'profile.aboutMe': 'About me',
    'profile.noBio': 'No bio provided yet.',
    'profile.displayNamePlaceholder': 'Display name',
    'profile.nativePlaceholder': 'Native language (ISO)',
    'profile.targetPlaceholder': 'Target languages (comma separated)',
    'profile.bioPlaceholder': 'Bio and learning goals',
    'profile.hideLocation': 'Hide my location in discovery',
    'profile.hideSearch': 'Hide my profile in search',
    'profile.hideAge': 'Hide my age',
    'profile.avatarUrlPlaceholder': 'Avatar URL',
    'profile.saveChangesBtn': 'Save changes',
    'profile.updateSuccess': 'Profile updated successfully.',
    'profile.loadError': 'Failed to load profile',
    'profile.updateError': 'Failed to update profile',
    'hobby.add': '+ Add Hobby',

    'visitors.title': 'Who viewed me',
    'visitors.subtitle': 'Recent profile visitors and language matches.',
    'visitors.visibleCount': 'Visible: {{count}}',
    'visitors.blurredCount': 'Blurred: {{count}}',
    'visitors.showAllBtn': 'Show all',
    'visitors.hideBlurredBtn': 'Hide blurred',
    'visitors.vipBannerTitle': 'Unlock full visitor identities with VIP',
    'visitors.vipBannerDesc': 'Visitor details are blurred on the free tier.',
    'visitors.vipPrice': '8 UKP / $10 USD per month',
    'visitors.loading': 'Loading visitors...',
    'visitors.empty': 'No visitors yet.',
    'visitors.partnerFallback': 'Language partner',
    'visitors.vipOnly': 'VIP only',
    'visitors.visibleStatus': 'Visible',

    // Doodle Pad
    'doodle.title': '🎨 Interactive Doodle Pad',
    'doodle.colorLabel': 'Colour',
    'doodle.brushLabel': 'Brush',
    'doodle.clearBtn': '🗑️ Clear canvas',
    'doodle.cancelBtn': 'Cancel',
    'doodle.sendBtn': '📤 Send doodle',

    // Visual Diff
    'visualDiff.title': '✏️ Language Correction Diff',
    'visualDiff.subtitle': 'Intl.Segmenter word engine',
    'visualDiff.tutorExplanation': '💡 Tutor explanation:',

    // Word Definition Modal
    'wordModal.badge': 'LingQ Interactive Reader',
    'wordModal.title': 'Dictionary Definition',
    'wordModal.listenTitle': 'Listen to pronunciation',
    'wordModal.translationLabel': 'Translation',
    'wordModal.definitionLabel': 'Dictionary definition',
    'wordModal.contextLabel': 'Context:',
    'wordModal.srsStatus': 'Spaced repetition status: {{status}}',
    'wordModal.levelStatus': 'Level {{level}}',
    'wordModal.newStatus': 'New (Blue)',
    'wordModal.saveLearningBtn': '🟡 Save to learning',
    'wordModal.markKnownBtn': '⚪ Mark known',
    'wordModal.resetBtn': 'Reset to new (Level 0 / Blue)',

    // Voice Recorder
    'voiceRecorder.title': '🎙️ Voice Note Recorder',
    'voiceRecorder.chipSpeak': '🎙️ Speak clearly',
    'voiceRecorder.chipSend': '📤 Send to chat',
    'voiceRecorder.startBtn': '⏺️ Start recording',
    'voiceRecorder.stopBtn': '⏹️ Stop recording',
    'voiceRecorder.sendBtn': '📤 Send voice note',
    'voiceRecorder.uploadingBtn': '⏳ Uploading to Cloudflare R2...',

    // Trust Safety Modal
    'safety.title': '🛡️ Trust and safety moderation',
    'safety.subtitle': 'Report or block {{name}} to keep our community safe',
    'safety.tabReport': '⚠️ Report user',
    'safety.tabBlock': '🚫 Block user',
    'safety.reasonLabel': 'Select violation category:',
    'safety.optHarassment': 'Harassment / Bullying',
    'safety.optSpam': 'Spam / Commercial Advertising',
    'safety.optInappropriate': 'Inappropriate / Offensive Language',
    'safety.optScam': 'Suspicious Link / Scam',
    'safety.optOther': 'Other Violation',
    'safety.detailsLabel': 'Additional context (optional):',
    'safety.detailsPlaceholder': 'Provide context or specific phrase where violation occurred...',
    'safety.blockWarning': '⚠️ What happens when you block {{name}}:',
    'safety.blockList1': 'They will not be able to send you direct chat messages.',
    'safety.blockList2': 'Their Moments will immediately vanish from your timeline.',
    'safety.blockList3': 'They cannot see when you visit their profile.',
    'safety.cancelBtn': 'Cancel',
    'safety.submitReportBtn': 'Submit report',
    'safety.confirmBlockBtn': 'Confirm block',

    // Virtual Gift Modal
    'giftModal.title': '🎁 Send virtual gift to host',
    'giftModal.subtitle': 'Support language partners with animated tokens',
    'giftModal.balanceLabel': 'Your coin balance:',
    'giftModal.coinsValue': '{{coins}} coins',
    'giftModal.backToGiftsBtn': 'Back to gifts',
    'giftModal.buyCoinsBtn': '+ Buy coins',
    'giftModal.bundlePrompt': 'Select a coin bundle to recharge:',
    'giftModal.package.coins_small.title': 'Starter Pouch ({{coins}} Coins)',
    'giftModal.package.coins_small.desc': 'Great for sending roses and coffees',
    'giftModal.package.coins_medium.title': 'Popular Chest ({{coins}} Coins)',
    'giftModal.package.coins_medium.desc': '🔥 Most popular bundle',
    'giftModal.package.coins_large.title': 'Royal Vault ({{coins}} Coins)',
    'giftModal.package.coins_large.desc': 'Unlock crowns and rocket boosts',
    'giftModal.package.coins_mega.title': 'Mega Hoard ({{coins}} Coins)',
    'giftModal.package.coins_mega.desc': 'Best value for top gifters',
    'giftModal.priceLabel': '{{ukp}} UKP / ${{usd}} USD',
    'giftModal.selectPrompt': 'Select virtual gift to send to {{name}}:',
    'giftModal.giftCost': '🪙 {{cost}} Coins',
    'giftModal.cancelBtn': 'Cancel',
    'giftModal.sendingBtn': 'Sending...',
    'giftModal.sendBtnText': '🎁 Send {{icon}} ({{cost}} coins)',
    'giftModal.selectGift': 'Select a gift',

    // Coin Purchase Success / Cancel
    'coinsSuccess.title': '🎉 Coins added!',
    'coinsSuccess.failureTitle': 'Purchase could not be confirmed',
    'coinsSuccess.message': 'Thank you. Your coins have been credited to your balance.',
    'coinsSuccess.pending': 'Confirming your purchase with our payment provider...',
    'coinsSuccess.failureMessage':
      'We could not verify this purchase. If you were charged, please contact support.',
    'coinsSuccess.dashboardBtn': 'Go to Dashboard',
    'coinsCancel.title': 'Checkout Cancelled',
    'coinsCancel.message':
      'Your checkout was cancelled. No charges were made. You can try again anytime.',
    'coinsCancel.backBtn': 'Back to Dashboard',
    'economy.buyCoinsError': 'Could not start coin checkout right now.',
    'economy.purchaseSuccessToast':
      '🎉 Successfully purchased {{coins}} coins! Your new balance is {{newBalance}} coins.',
    'economy.purchaseConfirmError':
      'Could not confirm coin purchase. Please contact support if you were charged.',

    // Room Chat
    'roomChat.title': '💬 Synchronised room chat and subtitles',
    'roomChat.showChatBtn': '💬 Show chat',
    'roomChat.showSubtitlesBtn': '🎙️ Show AI subtitles ({{count}})',
    'roomChat.emptyChat': 'No messages in this live room yet. Say hello to the stage speakers!',
    'roomChat.emptySubtitles':
      'No live subtitles yet. When speakers talk on stage or use speech-to-text, closed captions broadcast here!',
    'roomChat.speakerCaptionPrefix': '🎙️ {{name}} (Live AI caption):',
    'roomChat.inputPlaceholder': 'Send a chat message to the room...',
    'roomChat.sendBtn': 'Send',
    'roomChat.subtitlePlaceholder': 'Simulate speech-to-text live subtitle broadcast...',
    'roomChat.broadcastBtn': 'Broadcast caption',

    // Text to Speech
    'tts.speaking': '🔊 Speaking...',
    'tts.listen': '🔊 Listen',
    'tts.title': 'Listen to native pronunciation of this text ({{lang}})',
    'tts.unsupported': 'Text-to-speech is not supported in this browser environment.',

    // Context Menu
    'context_menu.copy': 'Copy',
    'context_menu.favourite': 'Favourite',
    'context_menu.report': 'Report',
    'context_menu.block': 'Block',
    'context_menu.unblock': 'Unblock',

    // Report User Modal
    'report.button_label': 'Report',
    'report.title': 'Report user',
    'report.close': 'Close',
    'report.reason_label': 'Reason for reporting',
    'report.category.harassment.label': 'Harassment',
    'report.category.harassment.description': 'Unwanted advances, threats, or abusive behaviour',
    'report.category.spam.label': 'Spam',
    'report.category.spam.description': 'Unsolicited promotions, phishing, or fraudulent activity',
    'report.category.inappropriate_content.label': 'Inappropriate content',
    'report.category.inappropriate_content.description':
      'Sexually explicit, violent, or offensive material',
    'report.category.fake_profile.label': 'Fake profile',
    'report.category.fake_profile.description': 'Impersonation or false identity',
    'report.category.other.label': 'Other',
    'report.category.other.description': 'Something else not listed above',
    'report.category_required': 'Please select a reason before submitting.',
    'report.details_label': 'Additional details (optional)',
    'report.details_placeholder': 'Describe what happened...',
    'report.block_user': 'Also block this user',
    'report.cancel': 'Cancel',
    'report.submit': 'Submit report',
    'report.submitting': 'Submitting...',
    'report.load_error': 'Could not load report categories.',
    'report.retry': 'Retry',
    'report.toast_success': 'Report submitted successfully.',
    'report.toast_error': 'Failed to submit report. Please try again.',
    'chat.message_blocked': 'This message is from a blocked user',
    'chat.unblock_user': 'Unblock user',

    // Chat System Messages (real-time bubbles published over Centrifugo)
    'system.profileUpdated': '{{name}} updated their profile.',
    'system.missedCall': 'You missed a call from {{name}}.',
    'system.groupRenamed': 'Group renamed to "{{name}}".',
    'system.memberAdded': '{{count}} member(s) joined the group.',
    'system.memberRemoved': 'A member left the group.',

    // VoIP Call UI
    'voip.mute': 'Mute',
    'voip.speaker': 'Speaker',
    'voip.endCall': 'End Call',
    'voip.connecting': 'Connecting...',
    'voip.ringing': 'Ringing...',
    'voip.connected': 'Connected',
    'voip.callEnded': 'Call Ended',
    'voip.dismiss': 'Dismiss',
    'voip.incomingVoiceCall': 'Incoming voice call...',
    'voip.incomingVideoCall': 'Incoming video call...',
    'common.unknownCaller': 'Unknown Caller',

    // Admin Portal (User Management)
    'admin.navLink': '🛠️ Admin',
    'admin.title': 'Admin Portal',
    'admin.subtitle': 'Search users, review login history, and manage VIP status.',
    'admin.searchLabel': 'Search users by name',
    'admin.searchPlaceholder': 'Search by display name...',
    'admin.searchBtn': 'Search',
    'admin.loading': 'Loading users...',
    'admin.empty': 'No users found.',
    'admin.loadError': 'Failed to load users. Please try again.',
    'admin.vipUpdateError': 'Failed to update VIP status. Please try again.',
    'admin.joined': 'Joined {{date}}',
    'admin.badgeAdmin': 'Admin',
    'admin.badgeVip': 'VIP',
    'admin.badgeFree': 'Free',
    'admin.coinsBadge': '🪙 {{coins}}',
    'admin.grantVipBtn': 'Grant VIP',
    'admin.revokeVipBtn': 'Revoke VIP',
    'admin.grantVipAria': 'Grant VIP status to {{name}}',
    'admin.revokeVipAria': 'Revoke VIP status from {{name}}',
    'admin.viewLoginHistory': 'View login history',
    'admin.loginHistoryLoading': 'Loading login history...',
    'admin.loginHistoryEmpty': 'No login history recorded yet.',
    'admin.paginationAria': 'User list pagination',
    'admin.prevPage': 'Previous',
    'admin.nextPage': 'Next',
    'admin.pageIndicator': 'Page {{page}} of {{totalPages}}',
    'admin.userBanned': 'User banned',
    'admin.banFailed': 'Ban failed',
    'admin.warningIssued': 'Warning issued',
    'admin.warningFailed': 'Warning failed',

    // Sticker Store
    'sticker.purchaseSuccess': 'Successfully purchased {{name}}!',
    'sticker.notEnoughCoins': 'Not enough coins!',
    // VIP Subscription page
    'vip.heroTitle': 'Unlock Your Language Learning Potential',
    'vip.heroSubtitle': 'Choose the plan that fits your learning journey. From free basics to premium power tools.',
    'vip.seePlans': 'See Plans',
    'vip.startFree': 'Start Free',
    'vip.tryAgain': 'Try Again',
    'vip.failedLoad': 'Failed to load subscription plans. Please try again later.',
    'vip.freeUpgrade': 'Start Free, Upgrade Anytime',
    'vip.getStartedFree': 'Get Started Free',
    'vip.freePrice': 'Free',
    'vip.premiumPlans': 'Premium Plans',
    'vip.premiumSubtitle': 'Unlock advanced features and accelerate your language learning journey',
    'vip.mostPopular': 'Most Popular',
    'vip.billedMonthly': 'billed monthly',
    'vip.keyBenefits': 'Key Benefits',
    'vip.allFeatures': 'All Features',
    'vip.subscribeNow': 'Subscribe Now',
    'vip.choosePlan': 'Choose {{name}}',
    'vip.compareAllFeatures': 'Compare All Features',
    'vip.featureTableHeader': 'Feature',
    'vip.faqTitle': 'Frequently Asked Questions',
    'vip.faqSwitchQ': 'Can I switch plans anytime?',
    'vip.faqSwitchA': 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.',
    'vip.faqTrialQ': 'Is there a free trial for premium plans?',
    'vip.faqTrialA': 'We offer a 7-day free trial for our Consumer VIP plan. No credit card required to start.',
    'vip.faqPaymentQ': 'What payment methods do you accept?',
    'vip.faqPaymentA': 'We accept all major credit cards, PayPal, and in-app purchases on iOS and Android.',
    'vip.faqCancelQ': 'Can I cancel my subscription?',
    'vip.faqCancelA': 'Absolutely. You can cancel anytime from your account settings. Your benefits continue until the end of the billing period.',
    'vip.ctaTitle': 'Ready to Accelerate Your Learning?',
    'vip.ctaSubtitle': 'Join thousands of language learners who have unlocked their full potential with HelloTalk Premium.',
    'vip.viewPlans': 'View Plans',
    'vip.continueFree': 'Continue Free',
    'vip.freePlan': 'Free',
    'vip.freeFeature1': 'Basic profile',
    'vip.freeFeature2': 'Limited daily AI calls',
    'vip.freeFeature3': 'Community access',
    'vip.consumerPlan': 'Consumer VIP',
    'vip.consumerPrice': '8 UKP / $10 USD',
    'vip.consumerFeature1': 'Unlimited AI calls',
    'vip.consumerFeature2': 'Global discovery',
    'vip.consumerFeature3': 'Location spoofing',
    'vip.consumerFeature4': 'Priority support',
    'vip.developerPlan': 'Developer VIP',
    'vip.developerPrice': '20 UKP / $26 USD',
    'vip.developerFeature1': 'All Consumer features',
    'vip.developerFeature2': 'API access',
    'vip.developerFeature3': '600 RPM rate limit',
    'vip.developerFeature4': 'Advanced analytics',
    'vip.developerFeature5': 'Sandbox environment',

    // Report confirm
    'report.confirmMessage': 'Are you sure you want to report this message?',
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
