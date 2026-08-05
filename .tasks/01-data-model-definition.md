* Priority: High Impact
* Description: Define the comprehensive TypeScript data model and JSON structure for the User Settings state, including Account, Profile, Social, App Preferences, and Notifications.
* Technical Implementation: Create a robust set of nested TypeScript interfaces to type the entire settings object. Implement this in a central Angular library or shared models folder (e.g., `frontend/src/app/core/models/settings.model.ts`). Use Enums for predefined options (e.g., `Theme`, `Visibility`). The root interface should be `UserSettings`, composed of sub-interfaces like `AccountSettings`, `ProfileSettings`, `SocialPrivacySettings`, `AppPreferences`, and `NotificationSettings`.

```typescript
// frontend/src/app/core/models/settings.model.ts

export enum Theme { Light = 'light', Dark = 'dark', System = 'system' }
export enum Visibility { Public = 'public', Friends = 'friends', Private = 'private' }
export enum OnlineStatus { Online = 'online', Idle = 'idle', DoNotDisturb = 'dnd', Invisible = 'invisible' }
export enum FriendRequestAllowList { Everyone = 'everyone', FriendsOfFriends = 'fof', ServerMembers = 'server' }

export interface AccountSettings {
  email: string;
  phone?: string;
  twoFactorEnabled: boolean;
  sessions: SessionInfo[];
  hardwareKeys: HardwareKey[];
}

export interface ProfileSettings {
  bio: string;
  nativeLanguage: string;
  targetLanguages: TargetLanguage[];
  ageFilter: { min: number; max: number };
  distanceRadius: number;
  matchingPreferences: Record<string, any>;
}

export interface SocialPrivacySettings {
  profileVisibility: Visibility;
  status: OnlineStatus;
  customStatus?: { emoji: string; text: string; expiresAt?: Date };
  readReceipts: boolean;
  directMessages: {
    allowFromServerMembers: boolean;
    explicitImageFilter: 'all' | 'non-friends' | 'none';
  };
  friendRequests: FriendRequestAllowList;
}

export interface AppPreferences {
  accessibility: {
    textToSpeech: boolean;
    screenReaderOptimized: boolean;
    reducedMotion: boolean;
  };
  appearance: {
    theme: Theme;
    compactMode: boolean;
    messageDisplay: 'cozy' | 'compact';
  };
  mediaAndLinks: {
    inlineImages: boolean;
    linkPreviews: boolean;
    autoplayGifs: boolean;
  };
}

export interface NotificationSettings {
  push: NotificationCategory;
  email: NotificationCategory;
}

export interface NotificationCategory {
  communication: boolean;
  social: boolean;
  recommendations: boolean;
  updates: boolean;
}

export interface UserSettings {
  id: string;
  userId: string;
  account: AccountSettings;
  profile: ProfileSettings;
  socialPrivacy: SocialPrivacySettings;
  app: AppPreferences;
  notifications: NotificationSettings;
}

// Auxiliary types
export interface SessionInfo { id: string; device: string; lastActive: Date; ip: string; }
export interface HardwareKey { id: string; name: string; addedAt: Date; }
export interface TargetLanguage { code: string; level: 'beginner' | 'intermediate' | 'advanced' | 'native'; jlptLevel?: string; kanaDisplay?: boolean; }
```
