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
    path: 'age-gate',
    loadComponent: () =>
      import('../components/age-gate/age-gate.component').then((m) => m.AgeGateComponent),
    title: 'Confirm your date of birth - HelloTalk',
  },
  {
    path: 'dmca',
    loadComponent: () =>
      import('../components/dmca-notice-form/dmca-notice-form.component').then(
        (m) => m.DmcaNoticeFormComponent,
      ),
    title: 'Report copyright infringement - HelloTalk',
  },
  {
    path: 'dmca/verify',
    loadComponent: () =>
      import('../components/dmca-verify/dmca-verify.component').then((m) => m.DmcaVerifyComponent),
    title: 'Confirm copyright notice - HelloTalk',
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
    loadComponent: () =>
      import('../pages/legal/dynamic-legal.component').then((m) => m.DynamicLegalComponent),
    data: { type: 'terms' },
    title: 'Terms of Service - HelloTalk',
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('../pages/legal/dynamic-legal.component').then((m) => m.DynamicLegalComponent),
    data: { type: 'privacy' },
    title: 'Privacy Policy - HelloTalk',
  },
  {
    path: 'legal/:type',
    loadComponent: () =>
      import('../pages/legal/dynamic-legal.component').then((m) => m.DynamicLegalComponent),
    title: 'Legal - HelloTalk',
  },
  {
    path: 'support',
    loadComponent: () =>
      import('../pages/support-centre/support-centre.component').then(
        (m) => m.SupportCentreComponent,
      ),
    title: 'Support Centre - HelloTalk',
  },
];
