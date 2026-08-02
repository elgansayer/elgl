# Priority: High Impact

# Description
Define a comprehensive, scalable TypeScript interface and JSON structure for the settings state. This serves as the single source of truth for all user preferences, mirroring the depth found in platforms like Discord, HelloTalk, and Bumble.

# Technical Implementation
Create a new file `frontend/src/app/models/settings.model.ts` and define the following interfaces.

```typescript
export interface UserSettings {
  account: AccountSecuritySettings;
  profile: ProfileDiscoverySettings;
  privacy: SocialPrivacySettings;
  preferences: AppPreferencesSettings;
  notifications: NotificationSettings;
}

export interface AccountSecuritySettings {
  email: string;
  isTwoFactorEnabled: boolean;
  activeSessions: Session[];
  hardwareKeys: HardwareKey[];
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: Date;
}

export interface HardwareKey {
  id: string;
  name: string;
  addedAt: Date;
}

export interface ProfileDiscoverySettings {
  bio: string;
  nativeLanguage: string;
  targetLanguages: TargetLanguage[];
  discoveryFilters: DiscoveryFilters;
}

export interface TargetLanguage {
  languageCode: string;
  proficiencyLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Native';
  jlptLevel?: string; // e.g., 'N5', 'N1'
  displayKana?: boolean;
}

export interface DiscoveryFilters {
  minAge: number;
  maxAge: number;
  distanceRadiusKm: number;
  matchingPreferences: 'language_exchange' | 'social' | 'both';
}

export interface SocialPrivacySettings {
  profileVisibility: 'everyone' | 'friends' | 'hidden';
  status: UserStatus;
  readReceiptsEnabled: boolean;
  directMessageControls: DMControls;
  friendRequestControls: FriendRequestControls;
}

export interface UserStatus {
  state: 'online' | 'idle' | 'dnd' | 'invisible';
  customText?: string;
  customEmoji?: string;
  expiresAt?: Date;
}

export interface DMControls {
  allowFromServerMembers: boolean;
  explicitImageFilter: 'all' | 'friends_only' | 'none';
}

export interface FriendRequestControls {
  allowFromEveryone: boolean;
  allowFromFriendsOfFriends: boolean;
  allowFromServerMembers: boolean;
}

export interface AppPreferencesSettings {
  accessibility: AccessibilitySettings;
  appearance: AppearanceSettings;
  media: MediaSettings;
}

export interface AccessibilitySettings {
  textToSpeechEnabled: boolean;
  screenReaderOptimized: boolean;
  reduceMotion: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system'; // Ensure strict adherence to dark mode (#121212) with neon accents as per guidelines
  compactMode: boolean;
  messageDisplayMode: 'cozy' | 'compact';
}

export interface MediaSettings {
  inlineImageDisplay: boolean;
  linkPreviews: boolean;
  autoPlayGifs: boolean;
}

export interface NotificationSettings {
  push: NotificationCategories;
  email: NotificationCategories;
}

export interface NotificationCategories {
  communication: boolean; // DMs, mentions
  social: boolean;        // Friend requests, likes
  recommendations: boolean; // New language partners
  updates: boolean;       // App updates, marketing
}
```
