import { Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../services/translate.pipe';
import { UserService } from '../../../services/user.service';
import { SettingsService } from '../../../core/services/settings.service';

type ImageFilterLevel = 'All' | 'Blurred' | 'None';
type ProfileVisibility = 'Everyone' | 'Friends' | 'ServerMembers' | 'Nobody';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="app-screen bg-surface-50">
      <header class="app-header">
        <button (click)="goBack()" class="app-button-icon" [attr.aria-label]="'common.back' | t">
          <span class="text-xl">&larr;</span>
        </button>
        <h1 class="app-header-title">{{ 'privacy.title' | t }}</h1>
        <div class="w-10"></div>
      </header>

      <main class="ps-4 pe-4 pt-4 pb-4 space-y-6 max-w-lg mx-auto">
        @if (isLoading()) {
          <div class="app-empty-state">{{ 'common.loading' | t }}</div>
        } @else {
          @if (errorMessage()) {
            <div class="rounded-card border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              {{ errorMessage() | t }}
            </div>
          }
          @if (successMessage()) {
            <div class="rounded-card border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
              {{ successMessage() | t }}
            </div>
          }

          <p class="text-sm text-text-secondary">{{ 'privacy.subtitle' | t }}</p>

          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
              {{ 'privacy.section.profileVisibility' | t }}
            </h2>
            <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden divide-y divide-surface-200 shadow-sm">
              @for (option of profileVisibilityOptions; track option) {
                <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                  <span class="text-sm font-medium text-text-primary">{{ 'privacy.visibility.' + option | t }}</span>
                  <input type="radio" name="profileVisibility" [value]="option"
                    [ngModel]="profileVisibility()" (ngModelChange)="profileVisibility.set($event)"
                    class="h-5 w-5 border-surface-300 text-primary focus:ring-primary/30" />
                </label>
              }
            </div>
          </section>

          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
              {{ 'privacy.section.profileInfo' | t }}
            </h2>
            <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden divide-y divide-surface-200 shadow-sm">
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.hideAge' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideAge()" (ngModelChange)="privacyHideAge.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.hideLocation' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideLocation()" (ngModelChange)="privacyHideLocation.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'settings.hideExactLocation' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideExactLocation()" (ngModelChange)="privacyHideExactLocation.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.hideGender' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideGender()" (ngModelChange)="privacyHideGender.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.hideFromSearch' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideSearch()" (ngModelChange)="privacyHideSearch.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'settings.hideOnlineStatus' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideOnlineStatus()" (ngModelChange)="privacyHideOnlineStatus.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'settings.hideVipStatus' | t }}</span>
                <input type="checkbox" [ngModel]="privacyHideVipStatus()" (ngModelChange)="privacyHideVipStatus.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
            </div>
          </section>

          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
              {{ 'privacy.section.incognito' | t }}
            </h2>
            <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden divide-y divide-surface-200 shadow-sm">
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-text-primary">{{ 'privacy.incognitoVisits' | t }}</span>
                  <span class="text-xs text-text-secondary">{{ 'privacy.incognitoVisitsHint' | t }}</span>
                </div>
                @if (isVip()) {
                  <input type="checkbox" [ngModel]="incognitoVisits()" (ngModelChange)="incognitoVisits.set($event)"
                    class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
                } @else {
                  <span class="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
                    {{ 'common.vip' | t }}
                  </span>
                }
              </label>
            </div>
          </section>

          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
              {{ 'privacy.section.directMessages' | t }}
            </h2>
            <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden divide-y divide-surface-200 shadow-sm">
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.dm.allowFromServerMembers' | t }}</span>
                <input type="checkbox" [ngModel]="allowDmFromServerMembers()" (ngModelChange)="allowDmFromServerMembers.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <div class="flex items-center justify-between p-4">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.dm.imageFilterLevel' | t }}</span>
                <select [ngModel]="imageFilterLevel()" (ngModelChange)="imageFilterLevel.set($event)"
                  class="bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30">
                  @for (opt of imageFilterOptions; track opt.value) {
                    <option [value]="opt.value">{{ opt.key | t }}</option>
                  }
                </select>
              </div>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.dm.readReceipts' | t }}</span>
                <input type="checkbox" [ngModel]="readReceipts()" (ngModelChange)="readReceipts.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
            </div>
          </section>

          <section class="space-y-4">
            <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
              {{ 'privacy.section.friendRequests' | t }}
            </h2>
            <div class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden divide-y divide-surface-200 shadow-sm">
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.friendRequests.allowFromEveryone' | t }}</span>
                <input type="checkbox" [ngModel]="friendRequestsEveryone()" (ngModelChange)="friendRequestsEveryone.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.friendRequests.allowFromFriendsOfFriends' | t }}</span>
                <input type="checkbox" [ngModel]="friendRequestsFriendsOfFriends()" (ngModelChange)="friendRequestsFriendsOfFriends.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
              <label class="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-200 transition-colors">
                <span class="text-sm font-medium text-text-primary">{{ 'privacy.friendRequests.allowFromServerMembers' | t }}</span>
                <input type="checkbox" [ngModel]="friendRequestsServerMembers()" (ngModelChange)="friendRequestsServerMembers.set($event)"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30" />
              </label>
            </div>
          </section>

          <div class="pt-2 pb-4">
            <button (click)="saveSettings()" [disabled]="isSaving()"
              class="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm disabled:opacity-50 transition-opacity">
              @if (isSaving()) {
                {{ 'privacy.saving' | t }}
              } @else {
                {{ 'privacy.saveBtn' | t }}
              }
            </button>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100dvh;
      background-color: var(--color-surface-50, #121212);
    }
  `],
})
export class PrivacySettingsComponent implements OnInit {
  private location = inject(Location);
  private userService = inject(UserService);
  private settingsService = inject(SettingsService);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly privacyHideLocation = signal(false);
  readonly privacyHideExactLocation = signal(false);
  readonly privacyHideSearch = signal(false);
  readonly privacyHideAge = signal(false);
  readonly privacyHideGender = signal(false);
  readonly privacyHideOnlineStatus = signal(false);
  readonly privacyHideVipStatus = signal(false);

  readonly incognitoVisits = signal(false);
  readonly isVip = signal(false);

  readonly profileVisibility = signal<ProfileVisibility>('Everyone');
  readonly readReceipts = signal(true);
  readonly allowDmFromServerMembers = signal(true);
  readonly imageFilterLevel = signal<ImageFilterLevel>('Blurred');
  readonly friendRequestsEveryone = signal(true);
  readonly friendRequestsFriendsOfFriends = signal(true);
  readonly friendRequestsServerMembers = signal(true);

  readonly profileVisibilityOptions: ProfileVisibility[] = [
    'Everyone',
    'Friends',
    'ServerMembers',
    'Nobody',
  ];

  readonly imageFilterOptions: { value: ImageFilterLevel; key: string }[] = [
    { value: 'All', key: 'privacy.imageFilter.all' },
    { value: 'Blurred', key: 'privacy.imageFilter.blurred' },
    { value: 'None', key: 'privacy.imageFilter.none' },
  ];

  async ngOnInit(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.isVip.set(Boolean(profile.is_vip));
        this.privacyHideLocation.set(Boolean(profile.privacy_hide_location));
        this.privacyHideSearch.set(Boolean(profile.privacy_hide_from_search));
        this.privacyHideAge.set(Boolean(profile.privacy_hide_age));
        this.privacyHideGender.set(Boolean(profile.privacy_hide_gender));
        this.privacyHideExactLocation.set(Boolean(profile.privacy_hide_exact_location));
        this.privacyHideOnlineStatus.set(Boolean(profile.privacy_hide_online_status));
        this.privacyHideVipStatus.set(Boolean(profile.privacy_hide_vip_status));
        this.incognitoVisits.set(Boolean(profile.incognito_visits));
      }
    } catch {
      this.errorMessage.set('privacy.loadError');
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await this.userService.updateMyProfile({
        privacy_hide_location: this.privacyHideLocation(),
        privacy_hide_from_search: this.privacyHideSearch(),
        privacy_hide_age: this.privacyHideAge(),
        privacy_hide_gender: this.privacyHideGender(),
        privacy_hide_exact_location: this.privacyHideExactLocation(),
        privacy_hide_online_status: this.privacyHideOnlineStatus(),
        privacy_hide_vip_status: this.privacyHideVipStatus(),
      });

      await this.settingsService.updatePrivacySettings({
        profileVisibility: this.profileVisibility(),
        readReceipts: this.readReceipts(),
        directMessages: {
          allowFromServerMembers: this.allowDmFromServerMembers(),
          imageFilterLevel: this.imageFilterLevel(),
        },
        friendRequests: {
          allowFromEveryone: this.friendRequestsEveryone(),
          allowFromFriendsOfFriends: this.friendRequestsFriendsOfFriends(),
          allowFromServerMembers: this.friendRequestsServerMembers(),
        },
      });

      this.successMessage.set('privacy.success');
    } catch {
      this.errorMessage.set('privacy.error');
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
