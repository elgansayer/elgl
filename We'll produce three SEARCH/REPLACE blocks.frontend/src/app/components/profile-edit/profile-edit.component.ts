import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, UserProfile } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-edit',
  templateUrl: './profile-edit.component.html',
  standalone: false,
})
export class ProfileEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  profile = signal<UserProfile | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form!: FormGroup;

  ngOnInit(): void {
    this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const p = await this.userService.getMyProfile();
      this.profile.set(p);
      this.initForm(p);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      this.loading.set(false);
    }
  }

  private initForm(p: UserProfile | null): void {
    this.form = this.fb.group({
      display_name: [p?.display_name ?? '', Validators.maxLength(50)],
      native_language: [p?.native_language ?? '', Validators.required],
      target_languages: [p?.target_languages?.join(',') ?? '', Validators.required],
      bio_text: [p?.bio_text ?? '', Validators.maxLength(500)],
      privacy_hide_age: [p?.privacy_hide_age ?? false],
      privacy_hide_location: [p?.privacy_hide_location ?? false],
      privacy_hide_from_search: [p?.privacy_hide_from_search ?? false],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    const raw = this.form.value;
    const targetLanguages = raw.target_languages
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const update: Partial<UserProfile> & {
      location?: { latitude: number; longitude: number };
      mock_location?: { latitude: number; longitude: number };
    } = {
      display_name: raw.display_name || undefined,
      native_language: raw.native_language,
      target_languages: targetLanguages,
      bio_text: raw.bio_text || undefined,
      privacy_hide_age: raw.privacy_hide_age,
      privacy_hide_location: raw.privacy_hide_location,
      privacy_hide_from_search: raw.privacy_hide_from_search,
    };

    try {
      const updated = await this.userService.updateMyProfile(update);
      this.profile.set(updated);
      this.success.set(true);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Update failed');
    } finally {
      this.loading.set(false);
    }
  }
}
