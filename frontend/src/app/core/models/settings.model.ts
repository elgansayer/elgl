export type LanguageLevel =
  'Beginner' | 'Elementary' | 'Intermediate' | 'Upper Intermediate' | 'Advanced' | 'Native';
export type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'None';

export interface AccountSettings {
  email: string;
  isEmailVerified: boolean;
  phone?: string;
  twoFactorEnabled: boolean;
  hardwareKeysCount: number;
  activeSessions: number;
}

export interface ProfileDiscoverySettings {
  bio: string;
  nativeLanguage: string;
  targetLanguages: Array<{
    language: string;
    level: LanguageLevel;
    jlptLevel?: JLPTLevel;
  }>;
  displayKana: boolean;
  ageFilter: { min: number; max: number };
  distanceRadiusKm: number;
  matchingPreferences: {
    gender: 'Any' | 'Male' | 'Female' | 'Non-binary';
    onlyVerified: boolean;
  };
}

export interface SocialPrivacySettings {
  profileVisibility: 'Everyone' | 'VipsOnly' | 'Hidden';
  status: 'Online' | 'Idle' | 'Do Not Disturb' | 'Invisible';
  customStatus?: {
    emoji?: string;
    text?: string;
    expiresAt?: string; // ISO Date string
  };
  readReceipts: boolean;
  directMessages: {
    allowFromServerMembers: boolean;
    imageFilterLevel: 'All' | 'Blurred' | 'None'; // Explicit image filters
  };
  friendRequests: {
    allowFromEveryone: boolean;
    allowFromFriendsOfFriends: boolean;
    allowFromServerMembers: boolean;
  };
}

export interface AppPreferences {
  accessibility: {
    textToSpeechEnabled: boolean;
    screenReaderOptimized: boolean;
    reduceMotion: boolean;
  };
  appearance: {
    theme: 'Light' | 'Dark' | 'System';
    compactMode: boolean;
    messageDisplay: 'Cozy' | 'Compact';
  };
  mediaLinks: {
    inlineImageDisplay: boolean;
    linkPreviews: boolean;
    autoplayGifs: boolean;
  };
}

export interface NotificationSettings {
  push: NotificationCategories;
  email: NotificationCategories;
}

export interface NotificationCategories {
  communication: boolean; // DMs, mentions
  social: boolean; // Friend requests, likes
  recommendations: boolean; // Match suggestions
  updates: boolean; // App updates, marketing
}

export interface UserSettings {
  id: string; // User ID
  account: AccountSettings;
  profile: ProfileDiscoverySettings;
  social: SocialPrivacySettings;
  preferences: AppPreferences;
  notifications: NotificationSettings;
}
