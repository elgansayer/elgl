Priority: High Impact

Description:
Define a comprehensive, scalable settings system and user profile configuration area. This data model will serve as the foundation for the settings interface, encompassing account security, profile discovery, social privacy, app preferences, and notifications.

Technical Implementation:
Create a robust TypeScript interface (`settings.interface.ts`) to strictly type the settings state. The structure must be nested and granular.

```typescript
export interface UserSettings {
  account: {
    email: string;
    isEmailVerified: boolean;
    twoFactorEnabled: boolean;
    hardwareKeyEnabled: boolean;
    activeSessions: Array<{
      id: string;
      device: string;
      location: string;
      lastActive: string;
      current: boolean;
    }>;
  };
  profile: {
    bio: string;
    nativeLanguage: string;
    targetLanguages: Array<{
      language: string;
      proficiencyLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Native';
      customGoals?: string;
    }>;
    discovery: {
      isVisible: boolean;
      ageFilter: { min: number; max: number };
      distanceRadiusKm: number;
      matchingPreferences: 'language_exchange' | 'friendship' | 'all';
    };
    displayOptions: {
      showKana: boolean; // Specific for Japanese learners
      showJLPT: boolean; // Specific for Japanese learners
    };
  };
  socialPrivacy: {
    profileVisibility: 'public' | 'friends' | 'server_members' | 'private';
    presence: {
      status: 'online' | 'idle' | 'dnd' | 'offline';
      customStatus: {
        text?: string;
        emoji?: string;
        expiresAt?: string;
      };
    };
    messaging: {
      readReceipts: boolean;
      allowDMsFrom: 'everyone' | 'friends' | 'server_members';
      explicitImageFiltering: 'strict' | 'blur' | 'off';
    };
    friendRequests: 'everyone' | 'friends_of_friends' | 'server_members' | 'nobody';
  };
  appPreferences: {
    accessibility: {
      textToSpeechEnabled: boolean;
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
  };
  notifications: {
    communication: {
      directMessages: { push: boolean; email: boolean };
      mentions: { push: boolean; email: boolean };
    };
    social: {
      friendRequests: { push: boolean; email: boolean };
      newFollowers: { push: boolean; email: boolean };
    };
    recommendations: {
      studyBuddies: { push: boolean; email: boolean };
      events: { push: boolean; email: boolean };
    };
    updates: {
      appUpdates: { push: boolean; email: boolean };
      marketing: { push: boolean; email: boolean };
    };
  };
}
```
