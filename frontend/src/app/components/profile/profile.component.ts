import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, viewChild, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { NgxSkeletonLoaderComponent } from 'ngx-skeleton-loader';
import { I18nService } from '../../services/i18n.service';
import {
  UserService,
  UserProfile,
  VisitorLog,
  BusinessCatalogItem,
} from '../../services/user.service';
import { CoverPhotoUploaderComponent } from '../cover-photo-uploader/cover-photo-uploader.component';
import { HobbyTagsComponent } from '../hobby-tags/hobby-tags.component';
import {
  LanguagePickerComponent,
  getLanguageFlag,
} from '../primitives/language-picker/language-picker.component';
import { CelebrationOverlayComponent } from '../celebration-overlay/celebration-overlay.component';
import { SafetyService } from '../../services/safety.service';
import { showToast } from '../../services/toast.service';
import { AchievementsComponent } from '../../achievements/achievements.component';
import { AudioIntroRecorderComponent } from '../audio-intro-recorder/audio-intro-recorder.component';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppChipComponent } from '../primitives/chip/chip.component';
import { AppInputComponent } from '../primitives/input/input.component';
import { AppTextareaComponent } from '../primitives/textarea/textarea.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

type PrivacyVisibility = 'everyone' | 'vips_only' | 'hidden';

@Component({
  selector: 'app-profile',
  imports: [
    HlmCheckbox,
    HlmNativeSelect,
    HlmInput,
    HlmButton,
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    NgxSkeletonLoaderComponent,
    CoverPhotoUploaderComponent,
    HobbyTagsComponent,
    LanguagePickerComponent,
    CelebrationOverlayComponent,
    AchievementsComponent,
    AudioIntroRecorderComponent,
    AppCardComponent,
    AppChipComponent,
    AppInputComponent,
    AppTextareaComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
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
  businessName = '';
  businessHours = '';
  websiteUrl = '';
  catalog: BusinessCatalogItem[] = [];
  nationality = '';
  region = '';
  age: number | null = null;
  gender = '';

  // Privacy fields
  incognitoVisits = signal<boolean>(false);
  privacyLastSeen: PrivacyVisibility = 'everyone';
  privacyProfilePhoto: PrivacyVisibility = 'everyone';
  privacyAboutInfo: PrivacyVisibility = 'everyone';
  privacyStatus: PrivacyVisibility = 'everyone';

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
        this.privacyLastSeen = this.sanitizePrivacyVisibility(data.privacy_last_seen);
        this.privacyProfilePhoto = this.sanitizePrivacyVisibility(data.privacy_profile_photo);
        this.privacyAboutInfo = this.sanitizePrivacyVisibility(data.privacy_about_info);
        this.privacyStatus = this.sanitizePrivacyVisibility(data.privacy_status);
        this.proficiencyLevel.set(data.proficiency_level || 'B1');
        this.learningGoals.set(data.learning_goals || '');
        this.statusText = data.status_text || '';
        this.businessName = data.business_name || '';
        this.businessHours = data.business_hours || '';
        this.websiteUrl = data.website_url || '';
        this.catalog = data.catalog || [];
        this.nationality = data.nationality || '';
        this.region = data.region || '';
        this.age = data.age || null;
        this.gender = data.gender || '';
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

  private sanitizePrivacyVisibility(value: string | undefined): PrivacyVisibility {
    if (value === 'vips_only' || value === 'hidden') {
      return value;
    }
    return 'everyone';
  }

  toggleEdit(): void {
    this.isEditing.set(!this.isEditing());
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  async onVisibilityChange(value: string): Promise<void> {
    if (value === 'everyone' || value === 'vips_only' || value === 'hidden') {
      this.profileVisibility.set(value);
    }
  }

  onIncognitoVisitsChange(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.incognitoVisits.set(input.checked);
    }
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.avatarPreviewUrl.set(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  onCustomAvatarFileSelected(event: Event): void {
    this.onAvatarFileSelected(event);
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

      // Update About status
      if (this.statusText) {
        await this.userService.updateAboutStatus(this.statusText);
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
        business_name: this.businessName,
        business_hours: this.businessHours,
        website_url: this.websiteUrl,
        catalog: this.catalog,
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
          incognito_visits: this.profile()?.is_vip ? this.incognitoVisits() : false,
        });
      } catch {
        // ignore privacy update errors
      }
      this.isEditing.set(false);
      this.successMessage.set(this.i18n.translate('profile.successUpdate'));
    } catch (e: unknown) {
      let errorMsg = this.i18n.translate('profile.updateError');
      if (isRecord(e)) {
        const err = e['error'];
        if (isRecord(err)) {
          const msg = err['message'];
          if (typeof msg === 'string') {
            errorMsg = msg;
          }
        } else if (typeof e['message'] === 'string') {
          errorMsg = e['message'];
        }
      }
      this.errorMessage.set(errorMsg);
    }
  }

  onAudioIntroSaved(mediaUrl: string): void {
    this.profile.update((p) => (p ? { ...p, audio_intro_url: mediaUrl } : p));
    showToast(this.i18n.translate('profile.audioIntroSaved'), 'success', 3000);
  }

  async blockProfile(): Promise<void> {
    const user = this.profile();
    if (!user) return;
    const confirmed = confirm(this.i18n.translate('safety.confirmBlockBtn'));
    if (!confirmed) return;
    try {
      await this.safetyService.blockUserAsync(user.id);
      showToast(this.i18n.translate('profile.blockedSuccess'), 'success', 4000);
    } catch {
      showToast(this.i18n.translate('profile.blockError'), 'error', 4000);
    }
  }

  async unblockProfile(): Promise<void> {
    const user = this.profile();
    if (!user) return;
    try {
      await this.safetyService.unblockUserAsync(user.id);
      showToast(this.i18n.translate('profile.unblockUser'), 'success', 4000);
    } catch {
      showToast(this.i18n.translate('profile.blockError'), 'error', 4000);
    }
  }

  async reportUser(): Promise<void> {
    const user = this.profile();
    if (!user) return;
    try {
      const categories = await this.safetyService.getReportCategories();
      if (!categories.length) {
        this.errorMessage.set(this.i18n.translate('profile.reportError'));
        return;
      }
      const options = categories.map((c, i) => `${i + 1}. ${c.label}`).join('\n');
      const title = this.i18n.translate('profile.reportSelectReason');
      const rawNumber = prompt(`${title}\n${options}`);
      if (!rawNumber) return;
      const idx = parseInt(rawNumber.trim(), 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= categories.length) {
        this.errorMessage.set(this.i18n.translate('profile.reportInvalidReason'));
        return;
      }
      const category = categories[idx];
      const descPrompt = this.i18n.translate('profile.reportDescriptionOptional');
      const descriptionInput = prompt(descPrompt);
      const description = descriptionInput ? descriptionInput.trim() : undefined;
      await this.safetyService.reportUserAsync({
        reported_id: user.id,
        reason_category: category.value,
        description,
      });
      showToast(this.i18n.translate('profile.reportSuccess'), 'success', 4000);
    } catch {
      showToast(this.i18n.translate('profile.reportError'), 'error', 4000);
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

  addCatalogItem(): void {
    const nextId = crypto.randomUUID();
    this.catalog.push({ id: nextId, name: '' });
  }

  removeCatalogItem(index: number): void {
    this.catalog.splice(index, 1);
  }

  updateCatalogItem(index: number, field: keyof BusinessCatalogItem, value: string): void {
    const current = [...this.catalog];
    current[index] = { ...current[index], [field]: value };
    this.catalog = current;
  }
}
