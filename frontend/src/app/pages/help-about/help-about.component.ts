import { Component, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-help-about',
  imports: [TranslatePipe],
  template: `
    <div class="max-w-2xl mx-auto p-4 text-center">
      <h1 class="text-2xl font-semibold mb-6">{{ 'helpAbout.title' | t }}</h1>
      <section class="space-y-3 mb-8">
        <div class="flex justify-between text-sm">
          <span>{{ 'helpAbout.appVersion' | t }}</span>
          <span class="font-mono">1.2.3</span>
        </div>
        <div class="flex justify-between text-sm">
          <span>{{ 'helpAbout.buildNumber' | t }}</span>
          <span class="font-mono">42</span>
        </div>
      </section>

      <h2 class="text-lg font-semibold mb-4">{{ 'helpAbout.openSourceLicences' | t }}</h2>
      <ul class="list-disc list-inside text-start text-sm space-y-1 max-h-64 overflow-y-auto">
        @for (licence of licences(); track licence.name) {
          <li>
            <span class="font-medium">{{ licence.name }}</span>
            <span class="text-slate-400 ms-2">{{ licence.licence }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class HelpAboutComponent {
  licences = computed(() => [
    { name: 'Angular', licence: 'MIT' },
    { name: 'NestJS', licence: 'MIT' },
    { name: 'Supabase', licence: 'Apache 2.0' },
    { name: 'Centrifugo', licence: 'MIT' },
    { name: 'LiveKit', licence: 'Apache 2.0' },
    { name: 'Redis', licence: 'BSD 3-Clause' },
    { name: 'PostgreSQL', licence: 'PostgreSQL' },
  ]);
}
