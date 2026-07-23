import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-2xl mx-auto p-4">
      <h1 class="text-2xl font-bold mb-6">Edit Profile</h1>

      <!-- Cover Photo -->
      <div class="mb-6">
        <label class="block text-sm font-medium mb-2">Cover Photo</label>
        <div class="relative w-full h-48 bg-gray-200 rounded-lg overflow-hidden">
          @if (coverPreview()) {
            <img
              [src]="coverPreview()"
              class="w-full h-full object-cover"
              alt="Cover preview"
            />
          }
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            (click)="coverFileInput.click()"
          >
            <span class="text-white text-sm">Change Cover Photo</span>
          </div>
        </div>
        <input
          #coverFileInput
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          (change)="onCoverSelected($event)"
        />
        <p class="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP only</p>
      </div>

      <!-- Display Name -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Display Name</label>
        <input
          [(ngModel)]="formData.display_name"
          maxlength="100"
          class="w-full border rounded px-3 py-2"
          placeholder="Your display name"
        />
      </div>

      <!-- Bio -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Bio</label>
        <textarea
          [(ngModel)]="formData.bio_text"
          maxlength="1000"
          rows="4"
          class="w-full border rounded px-3 py-2"
          placeholder="Tell others about yourself"
        ></textarea>
      </div>

      <!-- Native Language -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Native Language</label>
        <select
          [(ngModel)]="formData.native_language"
          class="w-full border rounded px-3 py-2"
        >
          <option value="">Select language</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ar">Arabic</option>
          <option value="he">Hebrew</option>
          <option value="fa">Persian</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="it">Italian</option>
          <option value="nl">Dutch</option>
          <option value="pl">Polish</option>
          <option value="tr">Turkish</option>
          <option value="vi">Vietnamese</option>
          <option value="th">Thai</option>
          <option value="hi">Hindi</option>
          <option value="bn">Bengali</option>
        </select>
      </div>

      <!-- Target Languages -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Target Languages</label>
        <div class="flex flex-wrap gap-2">
          @for (lang of formData.target_languages; track lang; let i = $index) {
            <div class="flex items-center bg-blue-100 rounded px-2 py-1">
              <span class="text-sm">{{ lang }}</span>
              <button
                type="button"
                class="ms-1 text-red-500 hover:text-red-700"
                (click)="removeTargetLanguage(i)"
              >
                &times;
              </button>
            </div>
          }
        </div>
        <select
          #langSelect
          class="mt-2 w-full border rounded px-3 py-2"
          (change)="addTargetLanguage(langSelect.value); langSelect.value = ''"
        >
          <option value="">Add language</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ar">Arabic</option>
          <option value="he">Hebrew</option>
          <option value="fa">Persian</option>
          <option value="zh">Chinese</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="it">Italian</option>
          <option value="nl">Dutch</option>
          <option value="pl">Polish</option>
          <option value="tr">Turkish</option>
          <option value="vi">Vietnamese</option>
          <option value="th">Thai</option>
          <option value="hi">Hindi</option>
          <option value="bn">Bengali</option>
        </select>
      </div>

      <!-- Privacy Settings -->
      <div class="mb-6 space-y-2">
        <label class="flex items-center gap-2">
          <input type="checkbox" [(ngModel)]="formData.privacy_hide_age" />
          <span class="text-sm">Hide my age</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" [(ngModel)]="formData.privacy_hide_location" />
          <span class="text-sm">Hide my location</span>
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" [(ngModel)]="formData.privacy_hide_from_search" />
          <span class="text-sm">Hide from search</span>
        </label>
      </div>

      <!-- Save Button -->
      <div class="flex gap-3">
        <button
          (click)="saveProfile()"
          [disabled]="saving()"
          class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving() ? 'Saving...' : 'Save Changes' }}
        </button>
        <button
          (click)="cancel()"
          class="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>

      <!-- Error / Success Messages -->
      @if (errorMessage()) {
        <div class="mt-4 p-3 bg-red-100 text-red-700 rounded">
          {{ errorMessage() }}
        </div>
      }
      @if (successMessage()) {
        <div class="mt-4 p-3 bg-green-100 text-green-700 rounded">
          {{ successMessage() }}
        </div>
      }
    </div>
  `,
  styles: [],
})
export class ProfileEditComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  saving = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  coverPreview = signal<string | null>(null);
  selectedCoverFile: File | null = null;

  formData = {
    display_name: '',
    bio_text: '',
    native_language: '',
    target_languages: [] as string[],
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
  };

  async ngOnInit() {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.formData.display_name = profile.display_name ?? '';
        this.formData.bio_text = profile.bio_text ?? '';
        this.formData.native_language = profile.native_language ?? '';
        this.formData.target_languages = profile.target_languages ?? [];
        this.formData.privacy_hide_age = profile.privacy_hide_age ?? false;
        this.formData.privacy_hide_location = profile.privacy_hide_location ?? false;
        this.formData.privacy_hide_from_search = profile.privacy_hide_from_search ?? false;
        if (profile.cover_photo_url) {
          this.coverPreview.set(profile.cover_photo_url);
        }
      }
    } catch (err) {
      this.errorMessage.set('Failed to load profile');
    }
  }

  onCoverSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.errorMessage.set('Only JPEG, PNG, and WebP images are allowed');
        return;
      }
      this.selectedCoverFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.coverPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  addTargetLanguage(lang: string) {
    if (lang && !this.formData.target_languages.includes(lang)) {
      this.formData.target_languages.push(lang);
    }
  }

  removeTargetLanguage(index: number) {
    this.formData.target_languages.splice(index, 1);
  }

  async saveProfile() {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      // Upload cover photo if selected
      if (this.selectedCoverFile) {
        const presigned = await this.userService.getPresignedCoverPhotoUrl(
          this.selectedCoverFile.name,
          this.selectedCoverFile.type,
        );
        await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: this.selectedCoverFile,
          headers: { 'Content-Type': this.selectedCoverFile.type },
        });
        await this.userService.updateCoverPhotoUrl(presigned.mediaUrl);
      }

      // Update profile fields
      await this.userService.updateMyProfile({
        display_name: this.formData.display_name || undefined,
        bio_text: this.formData.bio_text || undefined,
        native_language: this.formData.native_language || undefined,
        target_languages: this.formData.target_languages.length > 0 ? this.formData.target_languages : undefined,
        privacy_hide_age: this.formData.privacy_hide_age,
        privacy_hide_location: this.formData.privacy_hide_location,
        privacy_hide_from_search: this.formData.privacy_hide_from_search,
      });

      this.successMessage.set('Profile updated successfully');
      setTimeout(() => this.router.navigate(['/profile']), 1500);
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? 'Failed to save profile');
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.router.navigate(['/profile']);
  }
}
