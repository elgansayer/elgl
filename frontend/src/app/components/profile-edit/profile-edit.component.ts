import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, UserProfile } from '../../services/user.service';
import { CoverPhotoCropperComponent } from '../cover-photo-cropper/cover-photo-cropper.component';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, CoverPhotoCropperComponent],
  template: `
    <div class="max-w-2xl mx-auto p-6">
      <h2 class="text-2xl font-bold text-white mb-6">Edit Profile</h2>

      <!-- Cover Photo Section -->
      <div class="mb-8">
        <label class="block text-sm font-medium text-gray-300 mb-2">Cover Photo</label>
        <div class="relative h-48 bg-gray-800 rounded-xl overflow-hidden">
          @if (coverPhotoPreview()) {
            <img [src]="coverPhotoPreview()" alt="Cover preview" class="w-full h-full object-cover" />
          } @else if (profile()?.cover_photo_url) {
            <img [src]="profile()?.cover_photo_url" alt="Cover" class="w-full h-full object-cover" />
          } @else {
            <div class="flex items-center justify-center h-full text-text-muted">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          }

          <button
            (click)="fileInput.click()"
            class="absolute bottom-3 end-3 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Change Cover
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
          <label class="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
          <input
            [(ngModel)]="displayName"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        (click)="saveProfile()"
        class="mt-6 w-full py-3 text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
      >
        Save Profile
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
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
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
        'image/jpeg'
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
    });
  }
}
