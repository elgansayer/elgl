* Priority: High Impact
* Description: Define the comprehensive Data Model and TypeScript interfaces for the application settings state.
* Technical Implementation:
Create a strictly typed `UserSettings` interface and corresponding JSON structure to handle the complex state.

```typescript
export interface AccountSettings {
  email: string;
  is2FAEnabled: boolean;
  hardwareKeySupported: boolean;
  activeSessions: Session[];
}

export interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
}

export interface ProfileDiscoverySettings {
  bio: string;
  nativeLanguage: string;
  targetLanguages: TargetLanguage[];
  ageFilterMin: number;
  ageFilterMax: number;
  distanceRadiusKm: number;
  matchingPreferences: 'same_gender' | 'anyone' | 'native_speakers_only';
}

export interface TargetLanguage {
  languageCode: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'fluent' | 'native';
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'; // specific to Japanese
  showKana?: boolean; // specific to Japanese
}

export interface SocialPrivacySettings {
  profileVisibility: 'public' | 'friends' | 'server_members' | 'private';
  customStatus: {
    state: 'online' | 'idle' | 'dnd' | 'invisible';
    emoji?: string;
    text?: string;
  };
  readReceipts: boolean;
  directMessages: {
    allowFromServerMembers: boolean;
    explicitImageFilters: 'all' | 'friends_only' | 'none';
  };
  friendRequests: {
    everyone: boolean;
    friendsOfFriends: boolean;
    serverMembers: boolean;
  };
}

export interface AppSettings {
  accessibility: {
    ttsEnabled: boolean;
    screenReaderOptimized: boolean;
    reduceMotion: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
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
  communication: {
    pushDMs: boolean;
    emailDMs: boolean;
    pushMentions: boolean;
    emailMentions: boolean;
  };
  social: {
    pushFriendRequests: boolean;
    pushNewMatches: boolean;
  };
  recommendations: {
    pushLanguageTips: boolean;
    emailWeeklyDigest: boolean;
  };
  updates: {
    pushAppUpdates: boolean;
    emailNewsletters: boolean;
  };
}

export interface UserSettings {
  userId: string;
  account: AccountSettings;
  profile: ProfileDiscoverySettings;
  privacy: SocialPrivacySettings;
  preferences: AppSettings;
  notifications: NotificationSettings;
}
```

```json
{
  "userId": "user_12345",
  "account": {
    "email": "user@example.com",
    "is2FAEnabled": true,
    "hardwareKeySupported": false,
    "activeSessions": [
      {
        "id": "sess_abc123",
        "device": "iPhone 13",
        "ip": "192.168.1.1",
        "lastActive": "2023-10-27T10:00:00Z"
      }
    ]
  },
  "profile": {
    "bio": "Hello, I want to learn Japanese!",
    "nativeLanguage": "en",
    "targetLanguages": [
      {
        "languageCode": "ja",
        "proficiencyLevel": "beginner",
        "jlptLevel": "N5",
        "showKana": true
      }
    ],
    "ageFilterMin": 18,
    "ageFilterMax": 99,
    "distanceRadiusKm": 50,
    "matchingPreferences": "anyone"
  },
  "privacy": {
    "profileVisibility": "public",
    "customStatus": {
      "state": "online",
      "emoji": "🌸",
      "text": "Studying hard!"
    },
    "readReceipts": true,
    "directMessages": {
      "allowFromServerMembers": true,
      "explicitImageFilters": "all"
    },
    "friendRequests": {
      "everyone": false,
      "friendsOfFriends": true,
      "serverMembers": true
    }
  },
  "preferences": {
    "accessibility": {
      "ttsEnabled": false,
      "screenReaderOptimized": false,
      "reduceMotion": false
    },
    "appearance": {
      "theme": "system",
      "compactMode": false,
      "messageDisplay": "cozy"
    },
    "mediaAndLinks": {
      "inlineImages": true,
      "linkPreviews": true,
      "autoplayGifs": true
    }
  },
  "notifications": {
    "communication": {
      "pushDMs": true,
      "emailDMs": false,
      "pushMentions": true,
      "emailMentions": true
    },
    "social": {
      "pushFriendRequests": true,
      "pushNewMatches": true
    },
    "recommendations": {
      "pushLanguageTips": false,
      "emailWeeklyDigest": true
    },
    "updates": {
      "pushAppUpdates": true,
      "emailNewsletters": false
    }
  }
}
```