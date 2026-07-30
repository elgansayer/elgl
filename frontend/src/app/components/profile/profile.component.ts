import { Component, inject, signal, viewChild, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { I18nService } from '../../services/i18n.service';
import { UserService, UserProfile, VisitorLog } from '../../services/user.service';
import { CoverPhotoUploaderComponent } from '../cover-photo-uploader/cover-photo-uploader.component';
import { HobbyTagsComponent } from '../hobby-tags/hobby-tags.component';
import {
  LanguagePickerComponent,
  getLanguageFlag,
} from '../primitives/language-picker/language-picker.component';
import { CelebrationOverlayComponent } from '../celebration-overlay/celebration-overlay.component';
import { BlockService } from '../../services/block.service';
import { SafetyService } from '../../services/safety.service';
import { showToast } from '../../services/toast.service';

@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    NgxSkeletonLoaderComponent,
    CoverPhotoUploaderComponent,
    HobbyTagsComponent,
    LanguagePickerComponent,
    CelebrationOverlayComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private userService = inject(UserService);
  private readonly i18n = inject(I18nService);
  private safetyService = inject(SafetyService);

  readonly profile = signal<UserProfile | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isEditing = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly successMessage = signal<string>('');
  readonly visitors = signal<VisitorLog[]>([]);
  readonly isBlocked = computed(() => {
    const prof = this.profile();
    if (!prof) return false;
    return this.safetyService.blockedUserIdsSignal().has(prof.id);
  });
  readonly visitorsLoading = signal(false);
  readonly visitorsError = signal<string>('');
  readonly showVisitors = signal(false);

  readonly avatarPreviewUrl = signal<string>('');

  private selectedAvatarFile: File | null = null;

  protected readonly fileInput = viewChild<HTMLInputElement>('fileInput');

  // Editable fields
  displayName = '';
  nativeLanguages: string[] = ['en'];
  targetLanguages: string[] = ['es'];
  avatarUrl = '';
  bioText = '';
  statusText = '';
  proficiencyLevel = signal<string>('B1');
  learningGoals = signal<string>('');
  profileVisibility = signal<'everyone' | 'vips_only' | 'hidden'>('everyone');

  // Privacy fields
  incognitoVisits = signal<boolean>(false);
  privacyLastSeen = 'everyone';
  privacyProfilePhoto = 'everyone';
  privacyAboutInfo = 'everyone';
  privacyStatus = 'everyone';

  // Celebration state
  readonly showConfetti = signal<boolean>(false);
  readonly milestoneForConfetti = signal<number>(7);
  private readonly milestoneTriggered = new Set<number>();

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
    this.loadVisitors();
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
        this.avatarPreviewUrl.set(data.avatar_url || '');
        this.bioText = data.bio_text || '';
        this.statusText = data.status_text || '';
        this.profileVisibility.set(data.profile_visibility || 'everyone');
        this.incognitoVisits.set(data?.incognito_visits ?? false);
        this.privacyLastSeen = data.privacy_last_seen ?? 'everyone';
        this.privacyProfilePhoto = data.privacy_profile_photo ?? 'everyone';
        this.privacyAboutInfo = data.privacy_about_info ?? 'everyone';
        this.privacyStatus = data.privacy_status ?? 'everyone';
        this.proficiencyLevel.set(data.proficiency_level || 'B1');
        this.learningGoals.set(data.learning_goals || '');
        this.statusText = data.status_text || '';
        this.statusText = data.status_text || '';
        this.checkMilestone();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.errorMessage.set(message || this.i18n.translate('profile.loadError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadVisitors(): Promise<void> {
    this.visitorsLoading.set(true);
    this.visitorsError.set('');
    try {
      const visits = await this.userService.getMyVisitors();
      // Limit to 5 for display
      this.visitors.set(visits.slice(0, 5));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.visitorsError.set(message);
    } finally {
      this.visitorsLoading.set(false);
    }
  }

  private checkMilestone(): void {
    const streak = this.profile()?.study_streak_days ?? 0;
    const milestones: Array<7 | 30 | 100> = [100, 30, 7];
    for (const ms of milestones) {
      if (streak >= ms && !this.milestoneTriggered.has(ms)) {
        this.milestoneTriggered.add(ms);
        this.milestoneForConfetti.set(ms);
        this.showConfetti.set(true);
        return;
      }
    }
  }

  toggleEdit(): void {
    this.isEditing.set(!this.isEditing());
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async onVisibilityChange(value: string): Promise<void> {
    this.profileVisibility.set(value as 'everyone' | 'vips_only' | 'hidden');
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreviewUrl.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onAvatarClick(): void {
    const fileInputEl = this.fileInput();
    if (fileInputEl) {
      fileInputEl.click();
    } else {
      // fallback: directly use hidden file input from the DOM (already present)
      const hiddenInput = document.querySelector<HTMLInputElement>('#avatar-upload');
      if (hiddenInput) {
        hiddenInput.click();
      } else {
        this.toggleEdit();
      }
    }
  }

  async saveProfile(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    try {
      // Upload avatar if a new file was selected
      if (this.selectedAvatarFile) {
        this.avatarUrl = await this.userService.uploadAvatar(this.selectedAvatarFile);
        this.selectedAvatarFile = null;
      }

      const updated = await this.userService.updateMyProfile({
        display_name: this.displayName,
        native_languages: this.nativeLanguages,
        target_languages: this.targetLanguages,
        avatar_url: this.avatarUrl,
        bio_text: this.bioText,
        status_text: this.statusText,
        profile_visibility: this.profileVisibility(),
        proficiency_level: this.proficiencyLevel(),
        learning_goals: this.learningGoals(),
      });
      this.profile.set(updated);
      this.avatarPreviewUrl.set(updated.avatar_url || '');
      // Also save privacy settings
      try {
        await this.userService.updatePrivacySettings({
          privacy_last_seen: this.privacyLastSeen,
          privacy_profile_photo: this.privacyProfilePhoto,
          privacy_about_info: this.privacyAboutInfo,
          privacy_status: this.privacyStatus,
          incognito_visits: this.incognitoVisits(),
        });
      } catch {
        // ignore privacy update errors
      }
      this.isEditing.set(false);
      this.successMessage.set(this.i18n.translate('profile.successUpdate'));
    } catch (e: unknown) {
      let errorMsg = this.i18n.translate('profile.updateError');
      if (e && typeof e === 'object') {
        const obj = e as Record<string, unknown>;
        if (typeof obj['error'] === 'object' && obj['error'] !== null) {
          const errObj = obj['error'] as Record<string, unknown>;
          if (typeof errObj['message'] === 'string') {
            errorMsg = errObj['message'];
          }
        } else if (typeof obj['message'] === 'string') {
          errorMsg = obj['message'];
        }
      }
      this.errorMessage.set(errorMsg);
    }
  }

  playAudioIntro(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    audio.play();
  }

  async blockProfile(): Promise<void> {
    const user = this.profile();
    if (!user) return;
    const confirmed = confirm(this.i18n.translate('safety.confirmBlockBtn') || 'Are you sure you want to block this user?');
    if (!confirmed) return;
    try {
      await this.userService.blockUser(user.id);
      showToast(this.i18n.translate('profile.blockedSuccess') || 'User blocked', 'success', 4000);
    } catch {
      showToast(this.i18n.translate('profile.blockError') || 'Failed to block user', 'error', 4000);
    }
  }

  async unblockProfile(): Promise<void> {
    const user = this.profile();
    if (!user) return;
    try {
      await this.userService.unblockUser(user.id);
      showToast(this.i18n.translate('profile.unblockUser') || 'Unblocked', 'success', 4000);
    } catch {
      showToast(this.i18n.translate('profile.blockError') || 'Failed to unblock', 'error', 4000);
    }
  }

  async reportUser(): Promise<void> {
    const user = this.profile();
    if (!user) return;
    const reason = prompt(this.i18n.translate('profile.reportReasonPrompt') || 'Enter a reason for reporting');
    if (!reason) return;
    try {
      await this.userService.reportUser(user.id, reason);
      showToast(this.i18n.translate('profile.reportSuccess') || 'User reported', 'success', 4000);
    } catch {
      showToast(this.i18n.translate('profile.reportError') || 'Failed to report user', 'error', 4000);
    }
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
