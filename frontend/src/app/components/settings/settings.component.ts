import { Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, TranslatePipe],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
  private userService = inject(UserService);
  private location = inject(Location);

  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  privacyHideLocation = false;
  privacyHideSearch = false;
  privacyHideAge = false;
  privacyHideGender = false;

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.privacyHideLocation = Boolean(profile.privacy_hide_location);
        this.privacyHideSearch = Boolean(profile.privacy_hide_from_search);
        this.privacyHideAge = Boolean(profile.privacy_hide_age);
        this.privacyHideGender = Boolean((profile as any)['privacy_hide_gender']);
      }
    } catch {
      this.errorMessage.set('Failed to load settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }

  async saveSettings(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isLoading.set(true);

    try {
      await this.userService.updateMyProfile({
        privacy_hide_location: this.privacyHideLocation,
        privacy_hide_from_search: this.privacyHideSearch,
        privacy_hide_age: this.privacyHideAge,
        privacy_hide_gender: this.privacyHideGender,
      } as any);
      this.successMessage.set('Settings saved successfully');
    } catch {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isLoading.set(false);
    }
  }
}
