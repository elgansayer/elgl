import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private userService = inject(UserService);
  private readonly i18n = inject(I18nService);

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
    } catch (e: unknown) {
      const err = e as { message?: string };
      this.errorMessage.set(err.message || this.i18n.translate('profile.loadError'));
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
      this.successMessage.set(this.i18n.translate('profile.successUpdate'));
    } catch (e: unknown) {
      const err = e as { message?: string; error?: { message?: string } };
      this.errorMessage.set(err.error?.message || err.message || this.i18n.translate('profile.updateError'));
    }
  }

  playAudioIntro(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    audio.play();
  }
}
