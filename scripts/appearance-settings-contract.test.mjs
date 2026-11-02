import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const routesPath = 'frontend/src/app/routes/settings.routes.ts';
const componentPath =
  'frontend/src/app/pages/settings/appearance-settings/appearance-settings.component.ts';
const templatePath =
  'frontend/src/app/pages/settings/appearance-settings/appearance-settings.component.html';
const chatSettingsDtoPath = 'backend/src/chat/dto/chat-settings.dto.ts';
const chatSettingsServicePath = 'backend/src/chat/chat-settings.service.ts';

const [routes, component, template, chatSettingsDto, chatSettingsService] = await Promise.all([
  read(routesPath),
  read(componentPath),
  read(templatePath),
  read(chatSettingsDtoPath),
  read(chatSettingsServicePath),
]);

test('appearance settings remains a lazy-loaded settings route', () => {
  assert.match(routes, /path:\s*'settings\/appearance'/);
  assert.match(
    routes,
    /import\('\.\.\/pages\/settings\/appearance-settings\/appearance-settings\.component'\)/,
  );
  assert.match(routes, /m\) => m\.AppearanceSettingsComponent/);
});

test('theme, app text size, and chat text size remain independent controls', () => {
  assert.match(component, /themeOptions:\s*Theme\[\]\s*=\s*\['light', 'dark', 'system'\]/);
  assert.match(component, /textSizeOptions:[\s\S]*\['small', 'normal', 'large'\]/);
  assert.match(component, /chatTextSizeOptions:[\s\S]*\['small', 'medium', 'large'\]/);
  assert.match(component, /setTheme\(theme: Theme\)[\s\S]*setTheme\(theme\)/);
  assert.match(
    component,
    /setTextSize\(size: TextSizePreference\)[\s\S]*setTextSizePreference\(size\)/,
  );
  assert.match(
    component,
    /setChatTextSize\(size: ChatTextSizePreference\)[\s\S]*setChatTextSize\(size\)/,
  );
});

test('profile accent and chat text preferences are loaded and persisted through their owners', () => {
  assert.match(component, /userService\.getMyProfile\(\)/);
  assert.match(component, /chatSettingsService\.loadSettings\(\)/);
  assert.match(component, /userService\.updateMyProfile\(\{[\s\S]*primary_accent_color:/);
  assert.match(component, /chatSettingsService\.updateSetting\('textSize', chatTextSize\)/);
  assert.match(component, /successMessage\.set\('settings\.saved'\)/);
  assert.match(component, /errorMessage\.set\('settings\.appearanceLoadError'\)/);
  assert.match(component, /errorMessage\.set\('settings\.appearanceSaveError'\)/);
});

test('chat text size is validated and persisted by the backend owner', () => {
  assert.match(chatSettingsDto, /CHAT_TEXT_SIZES\s*=\s*\['small', 'medium', 'large'\]/);
  assert.match(chatSettingsDto, /@IsIn\(CHAT_TEXT_SIZES\)[\s\S]*textSize\?: ChatTextSize/);
  assert.match(chatSettingsService, /textSize:\s*'medium'/);
  assert.match(chatSettingsService, /textSize:\s*this\.normaliseChatTextSize\(prefs\.textSize\)/);
  assert.match(chatSettingsService, /textSize:\s*settings\.textSize \?\? current\.textSize/);
});

test('custom primary accents stay guarded by the VIP entitlement', () => {
  const vipGuards = component.match(/if \(!this\.isVip\(\)\) return;/g) ?? [];
  assert.ok(vipGuards.length >= 2, 'preset and custom accent mutations must both check VIP');
  assert.match(template, /\[disabled\]="!isVip\(\)"/);
  assert.match(template, /'settings\.vipRequired' \| t/);
  assert.match(template, /type="color"/);
});

test('UI language switching is delegated to the dedicated settings owner', () => {
  assert.match(component, /readonly currentLanguage = computed\(\(\) =>/);
  assert.match(component, /this\.i18nService\.currentLang\(\)/);
  assert.match(component, /this\.i18nService\.availableLanguages\.find/);
  assert.match(template, /routerLink="\/settings\/language"/);
  assert.match(template, /currentLanguage\(\)\.nativeName/);
  assert.doesNotMatch(component, /setLanguage\(/);
  assert.doesNotMatch(template, /<app-select/);
  assert.doesNotMatch(
    component,
    /updateMyProfile\(\{[\s\S]{0,250}(?:native_languages|target_languages)/,
  );
});

test('appearance controls preserve accessible selection and status semantics', () => {
  assert.match(template, /\[attr\.aria-pressed\]="currentTheme\(\) === opt"/);
  assert.match(template, /\[attr\.aria-pressed\]="currentTextSize\(\) === opt"/);
  assert.match(template, /\[attr\.aria-pressed\]="currentChatTextSize\(\) === opt"/);
  assert.match(template, /role="alert"/);
  assert.match(template, /role="status"/);
  assert.match(template, /aria-live="polite"/);
  assert.match(template, /min-h-11/);
  assert.match(template, /'settings\.selectAccentColour' \| t: \{ colour: color \}/);
});
