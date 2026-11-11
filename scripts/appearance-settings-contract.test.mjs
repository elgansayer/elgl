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
const hubComponentPath = 'frontend/src/app/components/settings/settings.component.ts';
const hubTemplatePath = 'frontend/src/app/components/settings/settings.component.html';
const i18nServicePath = 'frontend/src/app/services/i18n.service.ts';
const i18nMirrorPath = 'frontend/public/assets/i18n/en-GB.json';
const chatSettingsServicePath = 'frontend/src/app/services/chat-settings.service.ts';
const userServicePath = 'frontend/src/app/services/user.service.ts';
const backendDtoPath = 'backend/src/chat/dto/chat-settings.dto.ts';
const backendServicePath = 'backend/src/chat/chat-settings.service.ts';

const [
  routes,
  component,
  template,
  hubComponent,
  hubTemplate,
  i18nService,
  i18nMirrorSource,
  chatSettingsService,
  backendDto,
  backendService,
  userService,
] = await Promise.all([
  read(routesPath),
  read(componentPath),
  read(templatePath),
  read(hubComponentPath),
  read(hubTemplatePath),
  read(i18nServicePath),
  read(i18nMirrorPath),
  read(chatSettingsServicePath),
  read(backendDtoPath),
  read(backendServicePath),
  read(userServicePath),
]);

/** Keys of `I18nService.baseDictionary`, the dictionary the `t` pipe resolves against. */
function dictionaryKeys() {
  const start = i18nService.indexOf('private readonly baseDictionary');
  const end = i18nService.indexOf('readonly translations = signal');
  assert.ok(start >= 0 && end > start, 'baseDictionary must stay locatable');
  return new Set(
    [...i18nService.slice(start, end).matchAll(/^\s{4}'([^']+)':/gm)].map((match) => match[1]),
  );
}

/** Every translation key the Appearance page can ask for, static or built at runtime. */
function appearanceKeys() {
  const keys = new Set();
  for (const match of template.matchAll(/'([A-Za-z_][A-Za-z0-9_.]*)'\s*\|\s*t\b/g)) {
    keys.add(match[1]);
  }
  for (const theme of ['light', 'dark', 'system']) keys.add(`theme.${theme}`);
  for (const match of component.matchAll(/nameKey:\s*'([^']+)'/g)) keys.add(match[1]);
  for (const match of component.matchAll(/(?:errorMessage|successMessage)\.set\('([^']+)'\)/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function listLiteral(source, pattern) {
  const match = source.match(pattern);
  assert.ok(match, `missing list for ${pattern}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

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
  assert.match(component, /userService\.updateMyProfile\(\{\s*primary_accent_color:/);
  assert.match(component, /chatSettingsService\.updateSetting\('textSize', selected\)/);
  assert.match(component, /successMessage\.set\('settings\.saved'\)/);
  assert.match(component, /errorMessage\.set\('settings\.appearanceSaveError'\)/);
});

test('a rejected accent write is never reported as saved', () => {
  // The accent goes through the authenticated profile PATCH. The service must
  // not swallow a refused or lost write, and the page maps a rejection to a
  // save error instead of a success message.
  assert.match(component, /catch \{\s*return false;\s*\}/);
  const writeStart = userService.indexOf('async updateMyProfile(');
  assert.ok(writeStart >= 0, 'updateMyProfile must stay locatable');
  const writeMethod = userService.slice(writeStart);
  const writeBody = writeMethod.slice(0, writeMethod.indexOf('\n  }'));
  assert.match(writeBody, /firstValueFrom\(\s*this\.http\.patch<UserProfile>\(/);
  assert.doesNotMatch(writeBody, /\.pipe\(|catchError/);
});

test('unchanged preferences are not written again', () => {
  assert.match(component, /accent !== this\.savedAccentColor\(\)/);
  assert.match(component, /selected === this\.chatSettingsService\.textSize\(\)/);
});

test('custom primary accents stay guarded by the VIP entitlement', () => {
  // The entitlement and the stored value must both be known before an accent
  // can be edited, so a change can never be left unsavable.
  assert.match(
    component,
    /readonly accentEditingEnabled = computed\(\(\) => this\.serverSettingsAvailable\(\) && this\.isVip\(\)\);/,
  );
  const entitlementGuards =
    component.match(/if \(!this\.accentEditingEnabled\(\)\) return;/g) ?? [];
  assert.ok(
    entitlementGuards.length >= 2,
    'preset and custom accent mutations must both check the entitlement',
  );
  assert.match(template, /\[disabled\]="!accentEditingEnabled\(\)"/);
  assert.match(template, /'settings\.vipRequired' \| t/);
  assert.match(template, /type="color"/);
});

test('a custom accent must be a six-digit hex colour before it can be saved', () => {
  assert.match(component, /HEX_COLOUR_PATTERN = \/\^#\[0-9a-f\]\{6\}\$\/i/);
  assert.match(component, /if \(this\.accentInvalid\(\)\)/);
  assert.match(template, /\[attr\.aria-invalid\]="accentInvalid\(\)"/);
  assert.match(template, /aria-describedby/);
  assert.match(template, /accentInvalid\(\)/);
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
    /updateMyProfile(?:Strict)?\(\{[\s\S]{0,250}(?:native_languages|target_languages)/,
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
});

test('unreadable stored settings are reported, retryable and never guessed', () => {
  assert.match(component, /errorMessage\.set\('settings\.appearanceLoadError'\)/);
  assert.match(component, /retryLoad\(\): void \{\s*this\.settingsResource\.reload\(\);/);
  assert.match(template, /\(click\)="retryLoad\(\)"/);
  assert.match(template, /\[disabled\]="!chatSettingsAvailable\(\)"/);
  assert.match(template, /!serverSettingsAvailable\(\)/);
  assert.match(template, /profileAvailable\(\) && !isVip\(\)/);
});

test('direction-sensitive glyphs mirror in right-to-left layouts', () => {
  assert.match(template, /rtl:rotate-180[^"]*"\s+aria-hidden="true">←/);
  assert.match(template, /rtl:rotate-180"\s+aria-hidden="true">→/);
});

test('the chat text size sample follows the variable the chat bubbles use', () => {
  assert.match(template, /--chat-message-font-size/);
  assert.match(template, /id="appearance-chat-preview"[\s\S]{0,120}aria-hidden="true"/);
});

test('user-facing copy is a translation key, never an English literal', () => {
  for (const match of component.matchAll(/(?:errorMessage|successMessage)\.set\('([^']*)'\)/g)) {
    assert.ok(
      match[1] === '' || /^settings\.[A-Za-z]+$/.test(match[1]),
      `hard-coded message: ${match[1]}`,
    );
  }
  assert.doesNotMatch(template, /\[attr\.aria-label\]="'[A-Z][a-z]+ /);
  assert.doesNotMatch(template, /'Select colour/);
});

test('every translation key the page renders has copy in the runtime dictionary', () => {
  const dictionary = dictionaryKeys();
  const mirror = JSON.parse(i18nMirrorSource);
  const keys = appearanceKeys();
  assert.ok(keys.size >= 30, `expected a full set of keys, found ${keys.size}`);

  const missing = [...keys].filter((key) => !dictionary.has(key));
  assert.deepEqual(missing, [], 'keys with no baseDictionary entry render as raw keys');

  const missingFromMirror = [...keys].filter((key) => !(key in mirror));
  assert.deepEqual(missingFromMirror, [], 'keys missing from the en-GB.json mirror');
});

test('English copy follows the house style', () => {
  const dictionary = dictionaryKeys();
  const mirror = JSON.parse(i18nMirrorSource);
  for (const key of appearanceKeys()) {
    if (!dictionary.has(key)) continue;
    assert.ok(
      !String(mirror[key] ?? '').includes(String.fromCharCode(0x2014)),
      `${key} contains an em dash`,
    );
  }
});

test('Settings > Appearance is the single owner of the chat text size', () => {
  assert.doesNotMatch(hubComponent, /chatTextSize/);
  assert.doesNotMatch(hubComponent, /updateSetting\('textSize'/);
  assert.doesNotMatch(hubTemplate, /settings\.textSize/);
  assert.match(hubTemplate, /routerLink="\/settings\/appearance"/);
});

test('Reset on the Chat settings page leaves the Appearance text size alone', () => {
  const reset = chatSettingsService.slice(chatSettingsService.indexOf('async resetToDefaults'));
  const resetBody = reset.slice(0, reset.indexOf('private normalizeDisappearingMessagesTtl'));
  assert.doesNotMatch(resetBody, /textSize/);
});

test('the chat settings API accepts exactly the presets the page offers', () => {
  const frontend = listLiteral(component, /chatTextSizeOptions:[^=]*=\s*\[([^\]]*)\]/);
  const backend = listLiteral(backendDto, /CHAT_TEXT_SIZES\s*=\s*\[([^\]]*)\]/);
  assert.deepEqual(backend, frontend);
  assert.match(backendDto, /@IsIn\(CHAT_TEXT_SIZES\)\s+textSize\?: ChatTextSize/);
  assert.match(backendService, /textSize: settings\.textSize \?\? current\.textSize/);
  assert.match(backendService, /textSize: this\.normaliseChatTextSize\(prefs\.textSize\)/);
});
