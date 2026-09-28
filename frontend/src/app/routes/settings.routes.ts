import { Routes } from '@angular/router';

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
      import('../pages/settings/notification-settings/notification-settings.component').then(
        (m) => m.NotificationSettingsComponent,
      ),
    title: 'Notification Settings - HelloTalk',
  },
  {
    path: 'settings/notification-customization',
    redirectTo: 'settings/notification',
    pathMatch: 'full',
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
    path: 'language',
    redirectTo: 'settings/language',
    pathMatch: 'full',
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
    path: 'settings/privacy',
    loadComponent: () =>
      import('../pages/settings/privacy-settings/privacy-settings.component').then(
        (m) => m.PrivacySettingsComponent,
      ),
    title: 'Privacy Settings - HelloTalk',
  },
  {
    path: 'blocks',
    redirectTo: 'settings/blocks',
    pathMatch: 'full',
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
    path: 'data-storage',
    redirectTo: 'settings/data-storage',
    pathMatch: 'full',
  },
  {
    path: 'settings/data-storage',
    loadComponent: () =>
      import('../pages/data-storage/data-storage.component').then((m) => m.DataStorageComponent),
    title: 'Data & Storage - HelloTalk',
  },
  {
    path: 'device-transfer',
    redirectTo: 'settings/device-transfer',
    pathMatch: 'full',
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
    path: 'gdpr',
    redirectTo: 'settings/gdpr',
    pathMatch: 'full',
  },
  {
    path: 'settings/gdpr',
    loadComponent: () => import('../components/gdpr/gdpr.component').then((m) => m.GdprComponent),
    title: 'Personal Data - HelloTalk',
  },
  {
    path: 'account/deletion',
    redirectTo: 'settings/account/deletion',
    pathMatch: 'full',
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
    path: 'version',
    redirectTo: 'settings/version',
    pathMatch: 'full',
  },
  {
    path: 'settings/version',
    loadComponent: () =>
      import('../components/version-check/version-check.component').then(
        (m) => m.VersionCheckComponent,
      ),
    title: 'App Version - HelloTalk',
  },
];
