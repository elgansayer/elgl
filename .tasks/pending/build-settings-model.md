* Priority: High Impact
* Description: Define the comprehensive Data Model for the application settings system, handling complex nested settings for Account, Profile, Social, App Preferences, and Notifications.
* Technical Implementation: Create a `SettingsState` interface (e.g., in `frontend/src/app/models/settings.model.ts`) that precisely models the expected JSON structure from the backend. The structure should use nested interfaces for scalability.

```typescript
export interface SettingsState {
  account: {
    email: string;
    isEmailVerified: boolean;
    twoFactorEnabled: boolean;
    hardwareKeys: string[];
    activeSessions: Session[];
  };
  profile: {
    bio: string;
    nativeLanguage: string;
    targetLanguages: TargetLanguage[];
    discovery: {
      ageFilterMin: number;
      ageFilterMax: number;
      distanceRadiusKm: number;
      matchingPreferences: string[];
    };
  };
  social: {
    profileVisibility: 'public' | 'friends' | 'private';
    customStatus: {
      text: string;
      emoji: string;
      status: 'online' | 'idle' | 'dnd' | 'invisible';
    };
    readReceiptsEnabled: boolean;
    dmControls: {
      allowFromServerMembers: boolean;
      explicitImageFilter: 'all' | 'non_friends' | 'off';
    };
    friendRequestControls: 'everyone' | 'friends_of_friends' | 'server_members';
  };
  appPreferences: {
    accessibility: {
      ttsEnabled: boolean;
      screenReaderOptimized: boolean;
      reduceAnimations: boolean;
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
  };
  notifications: {
    communication: {
      directMessages: boolean;
      mentions: boolean;
      serverMessages: boolean;
    };
    social: {
      friendRequests: boolean;
      profileViews: boolean;
    };
    recommendations: {
      newMatches: boolean;
      learningTips: boolean;
    };
    updates: {
      appUpdates: boolean;
      marketing: boolean;
    };
  };
}

export interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string; // ISO Date String
}

export interface TargetLanguage {
  code: string;
  jlptLevel?: string;
  kanaDisplay?: 'romaji' | 'kana' | 'kanji';
}
```
