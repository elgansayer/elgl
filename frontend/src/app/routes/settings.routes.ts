import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { I18nService } from '../services/i18n.service';

export const settingsRoutes: Routes = [
  {
    path: 'settings/chat',
    loadComponent: () =>
      import('../pages/chat-settings/chat-settings.component').then(
        (m) => m.ChatSettingsComponent,
      ),
    title: 'Chat Settings - HelloTalk',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('../components/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'settings/account',
    loadComponent: () =>
      import('../pages/settings/account/account.component').then((m) => m.AccountSettingsComponent),
    title: 'Account Settings - HelloTalk',
  },
  {
    path: 'settings/notification',
    loadComponent: () =>
      import('../components/notification-preferences/notification-preferences.component').then(
        (m) => m.NotificationPreferencesComponent,
      ),
    title: 'Notification Settings - HelloTalk',
  },
  {
    path: 'settings/message-filters',
    loadComponent: () =>
      import('../pages/settings/message-filter-settings/message-filter-settings.component').then(
        (m) => m.MessageFilterSettingsComponent,
      ),
    title: 'Message Filters - HelloTalk',
  },
  {
    path: 'settings/appearance',
    loadComponent: () =>
      import('../pages/settings/appearance-settings/appearance-settings.component').then(
        (m) => m.AppearanceSettingsComponent,
      ),
    title: 'Appearance - HelloTalk',
  },
  {
    path: 'settings/language',
    loadComponent: () =>
      import('../pages/language-settings/language-settings.component').then(
        (m) => m.LanguageSettingsComponent,
      ),
    title: 'Language Settings - HelloTalk',
  },
  {
    path: 'language',
    redirectTo: 'settings/language',
    pathMatch: 'full',
  },
  {
    path: 'settings/privacy',
    loadComponent: () =>
      import('../pages/settings/privacy-settings/privacy-settings.component').then(
        (m) => m.PrivacySettingsComponent,
      ),
    title: 'Privacy Settings - HelloTalk',
  },
  {
    path: 'settings/blocks',
    loadComponent: () =>
      import('../pages/block-management/block-management.component').then(
        (m) => m.BlockManagementComponent,
      ),
    title: 'Blocked Users - HelloTalk',
  },
  {
    path: 'settings/blocked-users',
    redirectTo: 'settings/blocks',
    pathMatch: 'full',
  },
  {
    path: 'settings/backup-restore',
    loadComponent: () =>
      import('../pages/settings/backup-restore.component').then((m) => m.BackupRestoreComponent),
    title: 'Chat Backup & Restore - HelloTalk',
  },
  {
    path: 'settings/linked-accounts',
    loadComponent: () =>
      import('../pages/settings/linked-accounts/linked-accounts.component').then(
        (m) => m.LinkedAccountsComponent,
      ),
    title: 'Linked Accounts - HelloTalk',
  },
  {
    path: 'settings/data-storage',
    loadComponent: () =>
      import('../pages/data-storage/data-storage.component').then((m) => m.DataStorageComponent),
    title: 'Data & Storage - HelloTalk',
  },
  {
    path: 'settings/device-transfer',
    loadComponent: () =>
      import('../components/device-transfer/device-transfer.component').then(
        (m) => m.DeviceTransferComponent,
      ),
    title: 'Device Transfer - HelloTalk',
  },
  {
    path: 'settings/gdpr',
    loadComponent: () => import('../components/gdpr/gdpr.component').then((m) => m.GdprComponent),
    title: 'Personal Data - HelloTalk',
  },
  {
    path: 'settings/account/deletion',
    loadComponent: () =>
      import('../components/account-deletion/account-deletion.component').then(
        (m) => m.AccountDeletionComponent,
      ),
    title: 'Account Deletion - HelloTalk',
  },
  {
    path: 'settings/version',
    loadComponent: () =>
      import('../components/version-check/version-check.component').then(
        (m) => m.VersionCheckComponent,
      ),
    title: 'App Version - HelloTalk',
  },
  {
    path: 'settings/help-about',
    loadComponent: () =>
      import('../pages/help-about/help-about.component').then((m) => m.HelpAboutComponent),
    title: () => inject(I18nService).translate('helpAbout.title'),
  },
];
