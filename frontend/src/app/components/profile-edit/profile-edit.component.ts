import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { UserService, UserProfile } from '../../services/user.service';
import { CoverPhotoCropperComponent } from '../cover-photo-cropper/cover-photo-cropper.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-profile-edit',
  imports: [
    HlmNativeSelect,
    HlmInput,
    HlmButton,
    FormsModule,
    CoverPhotoCropperComponent,
    TranslatePipe,
  ],
  template: `
    <div class="max-w-2xl mx-auto p-6">
      <h2 class="text-2xl font-bold text-text-primary mb-6">{{ 'profileEdit.title' | t }}</h2>

      <!-- Cover Photo Section -->
      <div class="mb-8">
        <span class="block text-sm font-medium text-text-secondary mb-2">{{
          'profileEdit.coverPhoto' | t
        }}</span>
        <div class="relative h-48 bg-surface-200 rounded-xl overflow-hidden">
          @if (coverPhotoPreview()) {
            <img
              [src]="coverPhotoPreview()"
              alt="Cover preview"
              class="w-full h-full object-cover"
            />
          } @else if (profile()?.cover_photo_url) {
            <img
              [src]="profile()?.cover_photo_url"
              alt="Cover"
              class="w-full h-full object-cover"
            />
          } @else {
            <div class="flex items-center justify-center h-full text-text-muted">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          }

          <button
            hlmBtn
            (click)="fileInput.click()"
            class="absolute bottom-3 end-3 px-4 py-2 text-sm font-medium text-on-fill bg-primary hover:bg-primary-dark rounded-lg transition-colors"
          >
            {{ 'profileEdit.changeCover' | t }}
          </button>
          <input
            #fileInput
            type="file"
            accept="image/jpeg,image/png,image/webp"
            (change)="onFileSelected($event)"
            class="hidden"
          />
        </div>
      </div>

      <!-- Other profile fields -->
      <div class="space-y-4">
        <div>
          <label
            for="displayNameInput"
            class="block text-sm font-medium text-text-secondary mb-1"
            >{{ 'profileEdit.displayName' | t }}</label
          >
          <input
            hlmInput
            id="displayNameInput"
            [(ngModel)]="displayName"
            class="w-full px-4 py-2 bg-surface-200 border border-surface-100 rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label for="genderSelect" class="block text-sm font-medium text-text-secondary mb-1">{{
            'profileEdit.gender' | t
          }}</label>
          <hlm-native-select
            selectId="genderSelect"
            [(ngModel)]="gender"
            class="w-full px-4 py-2 bg-surface-200 border border-surface-100 rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
            selectClass="w-full px-4 py-2 bg-surface-200 border border-surface-100 rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{{ 'profileEdit.genderNone' | t }}</option>
            <option value="male">{{ 'profileEdit.genderMale' | t }}</option>
            <option value="female">{{ 'profileEdit.genderFemale' | t }}</option>
            <option value="other">{{ 'profileEdit.genderOther' | t }}</option>
          </hlm-native-select>
        </div>

        <!-- Business profile fields -->
        <div>
          <label
            for="businessNameInput"
            class="block text-sm font-medium text-text-secondary mb-1"
            >{{ 'profileEdit.businessName' | t }}</label
          >
          <input
            hlmInput
            id="businessNameInput"
            [(ngModel)]="businessName"
            class="w-full px-4 py-2 bg-surface-200 border border-surface-100 rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label
            for="businessHoursInput"
            class="block text-sm font-medium text-text-secondary mb-1"
            >{{ 'profileEdit.businessHours' | t }}</label
          >
          <input
            hlmInput
            id="businessHoursInput"
            [(ngModel)]="businessHours"
            class="w-full px-4 py-2 bg-surface-200 border border-surface-100 rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label for="websiteUrlInput" class="block text-sm font-medium text-text-secondary mb-1">{{
            'profileEdit.websiteUrl' | t
          }}</label>
          <input
            hlmInput
            id="websiteUrlInput"
            [(ngModel)]="websiteUrl"
            class="w-full px-4 py-2 bg-surface-200 border border-surface-100 rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      <button
        hlmBtn
        (click)="saveProfile()"
        class="mt-6 w-full py-3 text-on-fill bg-primary hover:bg-primary-dark rounded-lg font-medium transition-colors"
      >
        {{ 'profileEdit.save' | t }}
      </button>
    </div>

    @if (showCropper() && selectedFile()) {
      <app-cover-photo-cropper
        [imageFile]="selectedFile()!"
        (saveCover)="onSaveCroppedCover($event)"
        (cancel)="showCropper.set(false)"
      />
    }
  `,
})
export class ProfileEditComponent {
  private userService = inject(UserService);

  readonly profile = signal<UserProfile | null>(null);
  readonly displayName = signal('');
  readonly gender = signal('');
  readonly businessName = signal('');
  readonly businessHours = signal('');
  readonly websiteUrl = signal('');
  readonly coverPhotoPreview = signal<string | null>(null);
  readonly showCropper = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly isUploading = signal(false);

  constructor() {
    this.loadProfile();
  }

  private async loadProfile() {
    const profile = await this.userService.getMyProfile();
    if (profile) {
      this.profile.set(profile);
      this.displayName.set(profile.display_name || '');
      this.gender.set(profile.gender || '');
      this.businessName.set(profile.business_name || '');
      this.businessHours.set(profile.business_hours || '');
      this.websiteUrl.set(profile.website_url || '');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile.set(file);
      this.showCropper.set(true);
    }
    // Reset input so same file can be selected again
    input.value = '';
  }

  async onSaveCroppedCover(croppedBlob: Blob) {
    this.showCropper.set(false);
    this.isUploading.set(true);

    try {
      // Create a File from the Blob
      const croppedFile = new File([croppedBlob], 'cover-photo.jpg', { type: 'image/jpeg' });

      // Get presigned URL for upload
      const { uploadUrl, mediaUrl } = await this.userService.getPresignedCoverPhotoUrl(
        'cover-photo.jpg',
        'image/jpeg',
      );

      // Upload the cropped image
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: croppedFile,
        headers: { 'Content-Type': 'image/jpeg' },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload cover photo');
      }

      // Update the profile with the new cover photo URL
      const updatedProfile = await this.userService.updateCoverPhotoUrl(mediaUrl);
      this.profile.set(updatedProfile);
      this.coverPhotoPreview.set(mediaUrl);
    } catch (error) {
      console.error('Failed to upload cover photo:', error);
      // Show error to user
    } finally {
      this.isUploading.set(false);
    }
  }

  async saveProfile() {
    await this.userService.updateMyProfile({
      display_name: this.displayName(),
      gender: this.gender(),
      business_name: this.businessName() || undefined,
      business_hours: this.businessHours() || undefined,
      website_url: this.websiteUrl() || undefined,
    });
  }
}
