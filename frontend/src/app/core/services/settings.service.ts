import { Injectable, signal, computed } from '@angular/core';
import { UserSettings, SocialPrivacySettings, ProfileDiscoverySettings, AccountSettings } from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  // State
  private state = signal<UserSettings | null>(null);
  private loading = signal<boolean>(false);
  private error = signal<string | null>(null);

  // Selectors (computed signals)
  readonly settings = this.state.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly privacySettings = computed(() => this.state()?.social ?? null);
  readonly profileSettings = computed(() => this.state()?.profile ?? null);
  readonly accountSettings = computed(() => this.state()?.account ?? null);
  readonly theme = computed(() => this.state()?.preferences.appearance.theme ?? 'System');

  // Actions
  async loadSettings(userId: string) {
    this.loading.set(true);
    try {
      // Mock API fetch
      const data = await this.mockFetchSettings(userId);
      this.state.set(data);
    } catch {
      this.error.set('Failed to load settings');
    } finally {
      this.loading.set(false);
    }
  }

  // Optimistic Update Example
  async updatePrivacySettings(_newSettings: Partial<SocialPrivacySettings>) {
    const currentState = this.state();
    if (!currentState) return;

    // 1. Optimistically update UI
    this.state.update((state) => ({
      ...state!,
      social: { ...state!.social, ..._newSettings },
    }));

    // 2. Perform API Call
    try {
      // Mock API patch
      await this.mockPatchPrivacySettings(_newSettings);
      // Success: State is already correct
    } catch {
      // 3. Rollback on failure
      this.error.set('Failed to update privacy settings. Reverting.');
      this.state.set(currentState);
    }
  }

  async updateProfileSettings(_newSettings: Partial<ProfileDiscoverySettings>) {
    const currentState = this.state();
    if (!currentState) return;

    this.state.update((state) => ({
      ...state!,
      profile: { ...state!.profile, ..._newSettings },
    }));

    try {
      await this.mockPatchProfileSettings(_newSettings);
    } catch {
      this.error.set('Failed to update profile settings. Reverting.');
      this.state.set(currentState);
    }
  }

  async updateAccountSettings(_newSettings: Partial<AccountSettings>) {
    const currentState = this.state();
    if (!currentState) return;

    this.state.update((state) => ({
      ...state!,
      account: { ...state!.account, ..._newSettings },
    }));

    try {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
    } catch {
      this.error.set('Failed to update account settings. Reverting.');
      this.state.set(currentState);
    }
  }

  // Internal Mock API Methods
  private async mockFetchSettings(userId: string): Promise<UserSettings> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: userId,
          account: {
            email: 'user@example.com',
            isEmailVerified: true,
            twoFactorEnabled: true,
            hardwareKeysCount: 1,
            activeSessions: 3,
          },
          profile: {
            bio: 'Learning Japanese and exploring new cultures!',
            nativeLanguage: 'English',
            targetLanguages: [
              {
                language: 'Japanese',
                level: 'Beginner',
                jlptLevel: 'N5',
              },
            ],
            displayKana: true,
            ageFilter: { min: 20, max: 35 },
            distanceRadiusKm: 50,
            matchingPreferences: {
              gender: 'Any',
              onlyVerified: true,
            },
          },
          social: {
                profileVisibility: 'Everyone', // 'Everyone' | 'VipsOnly' | 'Hidden'
            status: 'Online',
            customStatus: {
              emoji: '🌸',
              text: 'Studying hard!',
            },
            readReceipts: true,
            directMessages: {
              allowFromServerMembers: true,
              imageFilterLevel: 'Blurred',
            },
            friendRequests: {
              allowFromEveryone: true,
              allowFromFriendsOfFriends: true,
              allowFromServerMembers: true,
            },
          },
          preferences: {
            accessibility: {
              textToSpeechEnabled: false,
              screenReaderOptimized: false,
              reduceMotion: false,
            },
            appearance: {
              theme: 'Dark',
              compactMode: false,
              messageDisplay: 'Cozy',
            },
            mediaLinks: {
              inlineImageDisplay: true,
              linkPreviews: true,
              autoplayGifs: false,
            },
          },
          notifications: {
            push: {
              communication: true,
              social: true,
              recommendations: false,
              updates: false,
            },
            email: {
              communication: false,
              social: false,
              recommendations: true,
              updates: true,
            },
          },
        });
      }, 500);
    });
  }

  private async mockPatchPrivacySettings(
    _newSettings: Partial<SocialPrivacySettings>,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 500);
    });
  }

  private async mockPatchProfileSettings(
    _newSettings: Partial<ProfileDiscoverySettings>,
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 500);
    });
  }
}
