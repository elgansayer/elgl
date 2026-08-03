# Priority: Medium Impact

# Description
Implement App Settings & Preferences, allowing users to customize accessibility options (TTS, reduce motion), appearance (theme, compact mode), and media display rules (inline images, link previews).

# Technical Implementation
1. Generate component: `ng g c components/settings/preferences-settings --standalone`
2. Create a reactive form linking to `AppPreferencesSettings`. Subscribe to form changes to update the central `SettingsService` Signal.
3. For the theme toggle, tie the settings update to a global service that applies CSS custom properties or classes to the `<body>` tag, adhering to the dark mode constraints (e.g., locking background to `#121212` if dark is selected).
4. Ensure all labels use the `t` pipe for translation (e.g., `{{ 'settings.preferences.theme' | t }}`).