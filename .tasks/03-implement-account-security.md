# Priority: High Impact

# Description
Implement the Account & Security settings UI and logic, allowing users to manage email, password, two-factor authentication (2FA), active sessions, and hardware security keys.

# Technical Implementation
1. Generate component: `ng g c components/settings/account-settings --standalone`
2. Create a reactive form using `FormBuilder` to bind to `AccountSecuritySettings` from `SettingsService`.
3. Implement `ChangeDetectionStrategy.OnPush` on the component for performance optimization.
4. For managing active sessions and hardware keys, use Angular `@for` loop over signals rather than calling functions directly in the template. Pre-calculate session duration in the component class.
5. Apply translation pipes `{{ 'settings.account.title' | t }}` per globalization guidelines using the feature.component.element convention.