import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const componentPath = path.join(
  frontendRoot,
  'src/app/components/discovery/discovery.component.ts',
);
const templatePath = path.join(
  frontendRoot,
  'src/app/components/discovery/discovery.component.html',
);

const component = fs.readFileSync(componentPath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');
const failures = [];

function requireText(source, marker, message) {
  if (!source.includes(marker)) failures.push(message);
}

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

// Distance/radius filtering must stay visible, reactive and VIP-gated.
requireText(template, '<app-distance-slider', 'Discovery must render the shared distance slider.');
requireText(
  template,
  '(distanceChanged)="onDistanceChanged($event)"',
  'Distance changes must update Discovery state.',
);
requireText(
  template,
  '[initialDistanceKm]="selectedDistanceKm()"',
  'Distance slider must reflect the selected radius.',
);
requireText(
  template,
  '[disabled]="!isVip()"',
  'Custom distance filtering must retain the existing VIP entitlement boundary.',
);
requirePattern(
  component,
  /radius_metres:\s*this\.selectedDistanceKm\(\)\s*\*\s*1000/,
  'Discovery search must send the selected radius to the partner API in metres.',
);

// Language filtering must stay available through both target-language pills and the picker.
requireText(
  template,
  '(click)="setLanguage(lang.code)"',
  'Target-language pills must update the selected language.',
);
requireText(
  template,
  '<app-language-picker',
  'Discovery must expose the shared language picker.',
);
requireText(
  template,
  '(languageSelected)="setLanguage($event)"',
  'Language-picker selections must update Discovery state.',
);
requireText(
  template,
  '[attr.aria-checked]="selectedTargetLanguage() === lang.code"',
  'Language choices must expose their selected state to assistive technology.',
);
requirePattern(
  component,
  /target_language:\s*this\.selectedTargetLanguage\(\)\s*\|\|\s*undefined/,
  'Discovery search must forward the selected target language.',
);

// Serious Learner mode is a persisted profile preference and an active search constraint.
requireText(
  template,
  'inputId="seriousModeCheckbox"',
  'Discovery must render the Serious Learner toggle.',
);
requireText(
  template,
  '[checked]="seriousLearnerMode()"',
  'Serious Learner toggle must reflect persisted state.',
);
requireText(
  template,
  '(change)="toggleSeriousLearnerMode()"',
  'Serious Learner toggle must persist user interaction.',
);
requireText(
  template,
  '<label for="seriousModeCheckbox" class="sr-only">',
  'Serious Learner toggle must have a programmatic label.',
);
requirePattern(
  component,
  /updateMyProfile\(\{\s*is_serious_learner:\s*newMode\s*\}\)/,
  'Serious Learner mode must persist through the profile API.',
);
requirePattern(
  component,
  /serious_learner_only:\s*this\.seriousLearnerOnly\(\)/,
  'Discovery search must apply the Serious Learner result filter.',
);
requirePattern(
  component,
  /serious_learner_mode:\s*this\.seriousLearnerMode\(\)/,
  'Discovery search must forward the persisted Serious Learner mode.',
);

// Keep the core loading, unavailable, retry and empty-state surfaces wired.
requireText(
  template,
  '<app-discovery-error-boundary',
  'Discovery must retain its error boundary.',
);
requireText(template, '(retry)="retrySearch()"', 'Discovery failures must expose a retry action.');
requireText(template, '<app-empty-state', 'Discovery must expose an empty-result state.');
requirePattern(
  component,
  /readonly isLoading = signal<boolean>\(true\)/,
  'Discovery must expose an explicit loading state.',
);
requirePattern(
  component,
  /readonly searchError = signal<string \| null>\(null\)/,
  'Discovery must expose an explicit search failure state.',
);

// Search results must continue to remove blocked accounts before rendering.
requirePattern(
  component,
  /blocked\.length === 0 \|\| !blocked\.includes\(user\.id\)/,
  'Blocked accounts must be excluded from Discovery results.',
);

if (failures.length > 0) {
  console.error('Discovery UI contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  'Discovery UI contract passed: distance, language, Serious Learner, failure-state and safety wiring are intact.',
);
