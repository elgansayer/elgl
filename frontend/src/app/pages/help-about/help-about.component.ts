import { Component, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { APP_VERSION, BUILD_NUMBER } from '../../version.constants';

interface ThirdPartyLicence {
  id: string;
  name: string;
  version: string;
  licence: string;
  packageUrl: string;
}

const LICENCE_MANIFEST_URL = '/assets/generated/third-party-licences.json';

function isThirdPartyLicence(value: unknown): value is ThirdPartyLicence {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'version' in value &&
    typeof value.version === 'string' &&
    'licence' in value &&
    typeof value.licence === 'string' &&
    'packageUrl' in value &&
    typeof value.packageUrl === 'string'
  );
}

function parseLicenceManifest(value: unknown): ThirdPartyLicence[] {
  if (!Array.isArray(value) || !value.every(isThirdPartyLicence)) {
    throw new Error('HELP_ABOUT_LICENCE_MANIFEST_INVALID');
  }
  return value;
}

@Component({
  selector: 'app-help-about',
  imports: [TranslatePipe],
  template: `
    <div class="max-w-2xl mx-auto p-4 text-center">
      <h1 class="text-2xl font-semibold mb-6">{{ 'helpAbout.title' | t }}</h1>
      <section class="space-y-3 mb-8">
        <div class="flex justify-between text-sm">
          <span>{{ 'helpAbout.appVersion' | t }}</span>
          <span class="font-mono">{{ appVersion }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span>{{ 'helpAbout.buildNumber' | t }}</span>
          <span class="font-mono">{{ buildNumber }}</span>
        </div>
      </section>

      <h2 class="text-lg font-semibold mb-4">{{ 'helpAbout.openSourceLicences' | t }}</h2>
      @if (licencesResource.isLoading()) {
        <p class="text-sm text-text-secondary" role="status">
          {{ 'common.loading' | t }}
        </p>
      } @else if (licencesResource.error()) {
        <p class="text-sm text-danger" role="alert">
          {{ 'common.error_generic' | t }}
        </p>
      } @else if (licencesResource.value()?.length === 0) {
        <p class="text-sm text-text-secondary">{{ 'support.noResults' | t }}</p>
      } @else {
        <ul class="list-disc list-inside text-start text-sm space-y-1 max-h-64 overflow-y-auto">
          @for (licence of licencesResource.value() ?? []; track licence.id) {
            <li>
              <a
                class="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                [href]="licence.packageUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ licence.name }}
                <span class="font-mono text-text-secondary">{{ licence.version }}</span>
              </a>
              <span class="text-text-secondary ms-2">{{ licence.licence }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class HelpAboutComponent {
  readonly appVersion = APP_VERSION;
  readonly buildNumber = BUILD_NUMBER;

  readonly licencesResource = resource<ThirdPartyLicence[], unknown>({
    loader: async () => {
      const response = await fetch(LICENCE_MANIFEST_URL);
      if (!response.ok) {
        throw new Error('HELP_ABOUT_LICENCE_MANIFEST_REQUEST_FAILED');
      }
      return parseLicenceManifest(await response.json());
    },
  });
}
