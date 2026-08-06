# Task: Build Settings Data Model

* **Priority:** High Impact
* **Description:** Define the comprehensive TypeScript interface and JSON structure for the user settings state, accommodating deep nesting and fine-grained controls similar to Discord and Bumble/HelloTalk.

## Technical Implementation

Implement the following TypeScript interfaces to strongly type the settings and preferences objects. Create a central `UserSettings` interface that can be serialized to JSON and stored in the database/local storage.

```typescript
// src/app/core/models/settings.model.ts

export type LanguageLevel = 'Beginner' | 'Elementary' | 'Intermediate' | 'Upper Intermediate' | 'Advanced' | 'Native';
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
  profileVisibility: 'Everyone' | 'Friends' | 'ServerMembers' | 'Nobody';
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
  social: boolean;        // Friend requests, likes
  recommendations: boolean; // Match suggestions
  updates: boolean;       // App updates, marketing
}

export interface UserSettings {
  id: string; // User ID
  account: AccountSettings;
  profile: ProfileDiscoverySettings;
  social: SocialPrivacySettings;
  preferences: AppPreferences;
  notifications: NotificationSettings;
}
```

### Example JSON Payload Structure

```json
{
  "id": "usr_12345",
  "account": {
    "email": "user@example.com",
    "isEmailVerified": true,
    "twoFactorEnabled": true,
    "hardwareKeysCount": 1,
    "activeSessions": 3
  },
  "profile": {
    "bio": "Learning Japanese and exploring new cultures!",
    "nativeLanguage": "English",
    "targetLanguages": [
      {
        "language": "Japanese",
        "level": "Beginner",
        "jlptLevel": "N5"
      }
    ],
    "displayKana": true,
    "ageFilter": { "min": 20, "max": 35 },
    "distanceRadiusKm": 50,
    "matchingPreferences": {
      "gender": "Any",
      "onlyVerified": true
    }
  },
  "social": {
    "profileVisibility": "Everyone",
    "status": "Online",
    "customStatus": {
      "emoji": "🌸",
      "text": "Studying hard!"
    },
    "readReceipts": true,
    "directMessages": {
      "allowFromServerMembers": true,
      "imageFilterLevel": "Blurred"
    },
    "friendRequests": {
      "allowFromEveryone": true,
      "allowFromFriendsOfFriends": true,
      "allowFromServerMembers": true
    }
  },
  "preferences": {
    "accessibility": {
      "textToSpeechEnabled": false,
      "screenReaderOptimized": false,
      "reduceMotion": false
    },
    "appearance": {
      "theme": "Dark",
      "compactMode": false,
      "messageDisplay": "Cozy"
    },
    "mediaLinks": {
      "inlineImageDisplay": true,
      "linkPreviews": true,
      "autoplayGifs": false
    }
  },
  "notifications": {
    "push": {
      "communication": true,
      "social": true,
      "recommendations": false,
      "updates": false
    },
    "email": {
      "communication": false,
      "social": false,
      "recommendations": true,
      "updates": true
    }
  }
}
```
