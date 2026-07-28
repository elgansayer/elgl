import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile } from '../../services/user.service';
import { CoverPhotoUploaderComponent } from '../cover-photo-uploader/cover-photo-uploader.component';
import { HobbyTagsComponent } from '../hobby-tags/hobby-tags.component';
import {
  LanguagePickerComponent,
  getLanguageFlag,
} from '../primitives/language-picker/language-picker.component';

@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    CoverPhotoUploaderComponent,
    HobbyTagsComponent,
    LanguagePickerComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
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
  nativeLanguages: string[] = ['en'];
  targetLanguages: string[] = ['es'];
  avatarUrl = '';
  bioText = '';

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
        this.nativeLanguages = data.native_languages;
        this.targetLanguages = data.target_languages || [];
        this.avatarUrl = data.avatar_url || '';
        this.bioText = data.bio_text || '';
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
    try {
      const updated = await this.userService.updateMyProfile({
        display_name: this.displayName,
        native_languages: this.nativeLanguages,
        target_languages: this.targetLanguages,
        avatar_url: this.avatarUrl,
        bio_text: this.bioText,
      });
      this.profile.set(updated);
      this.isEditing.set(false);
      this.successMessage.set(this.i18n.translate('profile.successUpdate'));
    } catch (e: unknown) {
      const err = e as { message?: string; error?: { message?: string } };
      this.errorMessage.set(
        err.error?.message || err.message || this.i18n.translate('profile.updateError'),
      );
    }
  }

  playAudioIntro(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    audio.play();
  }

  onCoverUploaded(coverUrl: string): void {
    this.profile.update((p) => (p ? { ...p, cover_photo_url: coverUrl } : p));
    this.successMessage.set(this.i18n.translate('profile.coverUpdated'));
  }

  getLanguageName(code: string): string {
    try {
      const enNames = new Intl.DisplayNames(['en'], { type: 'language' });
      return enNames.of(code) || code;
    } catch {
      return code;
    }
  }

  getLanguageFlagIcon(code: string): string {
    return getLanguageFlag(code);
  }

  addNativeLanguage(code: string) {
    if (this.nativeLanguages.length < 3 && !this.nativeLanguages.includes(code)) {
      this.nativeLanguages = [...this.nativeLanguages, code];
    }
  }

  removeNativeLanguage(code: string) {
    this.nativeLanguages = this.nativeLanguages.filter((l) => l !== code);
  }

  addTargetLanguage(code: string): void {
    if (this.targetLanguages.includes(code)) return;
    if (this.targetLanguages.length < 3) {
      this.targetLanguages.push(code);
    } else {
      this.errorMessage.set(
        this.i18n.translate('profile.maxLanguagesError') || 'Max 3 languages allowed',
      );
    }
  }

  removeTargetLanguage(code: string): void {
    this.targetLanguages = this.targetLanguages.filter((l) => l !== code);
  }
}
