import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService, UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private userService = inject(UserService);

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isEditing = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly successMessage = signal<string>('');

  // Editable fields
  displayName = '';
  nativeLanguage = 'en';
  targetLanguagesInput = 'es';
  bioText = '';
  privacyHideLocation = false;
  privacyHideSearch = false;

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.userService.getMyProfile();
      if (data) {
        this.profile.set(data);
        this.displayName = data.display_name || '';
        this.nativeLanguage = data.native_language;
        this.targetLanguagesInput = (data.target_languages || []).join(', ');
        this.bioText = data.bio_text || '';
        this.privacyHideLocation = Boolean(data.privacy_hide_location);
        this.privacyHideSearch = Boolean(data.privacy_hide_from_search);
      }
    } catch (e: any) {
      this.errorMessage.set(e.message || 'Failed to load profile');
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleEdit(): void {
    this.isEditing.set(!this.isEditing());
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async saveProfile(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    const targetLanguages = this.targetLanguagesInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    try {
      const updated = await this.userService.updateMyProfile({
        display_name: this.displayName,
        native_language: this.nativeLanguage,
        target_languages: targetLanguages,
        bio_text: this.bioText,
        privacy_hide_location: this.privacyHideLocation,
        privacy_hide_from_search: this.privacyHideSearch,
      });
      this.profile.set(updated);
      this.isEditing.set(false);
      this.successMessage.set('Profile updated successfully.');
    } catch (e: any) {
      this.errorMessage.set(e.error?.message || e.message || 'Failed to update profile');
    }
  }

  playAudioIntro(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    audio.play();
  }
}
