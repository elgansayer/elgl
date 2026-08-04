Priority: High Impact

Description: Define the comprehensive Data Model and TypeScript interface for the Settings state, handling complex nested configuration options across Account, Profile, Social, Application Preferences, and Notifications.

Technical Implementation: Create a robust `user-settings.model.ts` containing the `UserSettings` interface and its nested sub-interfaces. This will provide type safety and enforce the data structure for state management.

```typescript
// user-settings.model.ts

export interface UserSettings {
  account: AccountSettings;
  profile: ProfileSettings;
  social: SocialPrivacySettings;
  appPreferences: AppPreferences;
  notifications: NotificationSettings;
}

export interface AccountSettings {
  email: string;
  isEmailVerified: boolean;
  twoFactorAuthentication: {
    enabled: boolean;
    method: 'authenticator_app' | 'sms' | null;
    hardwareKeys: HardwareKey[];
  };
  activeSessions: Session[];
}

export interface HardwareKey {
  id: string;
  name: string;
  addedAt: Date;
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: Date;
}

export interface ProfileSettings {
  bio: string;
  nativeLanguage: string;
  targetLanguages: TargetLanguage[];
  discovery: DiscoverySettings;
}

export interface TargetLanguage {
  language: string;
  level: string; // e.g., 'JLPT N1', 'Beginner'
  showKana: boolean;
}

export interface DiscoverySettings {
  isVisibleInDiscovery: boolean;
  ageRange: { min: number; max: number };
  distanceRadiusKm: number;
  matchingPreferences: 'native_speakers' | 'learners' | 'both';
}

export interface SocialPrivacySettings {
  profileVisibility: 'everyone' | 'friends' | 'server_members' | 'nobody';
  status: {
    presence: 'online' | 'idle' | 'dnd' | 'invisible';
    customEmoji: string | null;
    customText: string | null;
  };
  readReceipts: boolean;
  directMessages: {
    allowFromServerMembers: boolean;
    explicitImageFilters: 'blur' | 'block' | 'off';
  };
  friendRequests: {
    allowFromEveryone: boolean;
    allowFromFriendsOfFriends: boolean;
    allowFromServerMembers: boolean;
  };
}

export interface AppPreferences {
  accessibility: {
    textToSpeech: boolean;
    screenReaderOptimized: boolean;
    reduceMotion: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    compactMode: boolean;
    messageDisplay: 'cozy' | 'compact';
  };
  media: {
    inlineImageDisplay: boolean;
    linkPreviews: boolean;
    autoPlayGifs: boolean;
  };
}

export interface NotificationSettings {
  push: NotificationChannels;
  email: NotificationChannels;
}

export interface NotificationChannels {
  communication: {
    directMessages: boolean;
    mentions: boolean;
  };
  social: {
    friendRequests: boolean;
    serverInvites: boolean;
  };
  recommendations: {
    newMatches: boolean;
    languageTips: boolean;
  };
  updates: {
    productAnnouncements: boolean;
    securityAlerts: boolean;
  };
}
```
