import { Routes } from '@angular/router';

/**
 * Auth & onboarding routes - login, registration, password flows, and onboarding wizard.
 */
export const authRoutes: Routes = [
  {
    path: 'onboarding',
    loadComponent: () =>
      import('../components/onboarding/onboarding-wizard.component').then(
        (m) => m.OnboardingWizardComponent,
      ),
    title: 'Onboarding - HelloTalk',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('../components/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
    title: 'Forgot Password - HelloTalk',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('../components/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
    title: 'Reset Password - HelloTalk',
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('../components/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
    title: 'Change Password - HelloTalk',
  },
  {
    path: 'lock',
    loadComponent: () =>
      import('../components/device-lock/device-lock.component').then((m) => m.DeviceLockComponent),
    title: 'App Lock - HelloTalk',
  },
  {
    path: 'terms',
    loadComponent: () => import('../pages/legal/terms.component').then((m) => m.TermsComponent),
    title: 'Terms of Service - HelloTalk',
  },
  {
    path: 'privacy',
    loadComponent: () => import('../pages/legal/privacy.component').then((m) => m.PrivacyComponent),
    title: 'Privacy Policy - HelloTalk',
  },
  {
    path: 'help',
    redirectTo: 'support',
    pathMatch: 'full',
  },
  {
    path: 'support',
    loadComponent: () =>
      import('../pages/support-centre/support-centre.component').then(
        (m) => m.SupportCentreComponent,
      ),
    title: 'Support Centre - HelloTalk',
  },
  {
    path: 'help-about',
    redirectTo: 'support',
    pathMatch: 'full',
  },
];
