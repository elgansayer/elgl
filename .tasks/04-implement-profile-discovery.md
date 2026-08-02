# Priority: High Impact

# Description
Implement the Profile & Discovery settings, allowing users to define their bio, native language, target languages (with proficiency/JLPT levels), and discovery filters (age range, distance radius, matching preferences).

# Technical Implementation
1. Generate component: `ng g c components/settings/profile-settings --standalone`
2. Create a reactive form group for `ProfileDiscoverySettings`, utilizing `FormArray` for dynamically adding/removing `TargetLanguage` entries.
3. Integrate with the `SettingsService` for saving changes using optimistic updates via Angular Signals.
4. Implement UI adhering strictly to the dark mode (`#121212`) palette with neon accents.
5. Use Tailwind logical properties (e.g., `ps-4`, `pe-4`, `margin-s-auto`) to ensure RTL/Globalisation compliance.