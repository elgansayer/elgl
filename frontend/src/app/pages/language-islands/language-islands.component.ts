import { Component, computed, inject, resource, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  LanguageIsland,
  LanguageIslandsService,
} from '../../services/language-islands.service';

@Component({
  selector: 'app-language-islands',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './language-islands.component.html',
  styleUrl: './language-islands.component.scss',
})
export class LanguageIslandsComponent {
  private readonly languageIslandsService = inject(LanguageIslandsService);

  readonly selectedLanguage = signal<string>('all');
  readonly enteredIslandId = signal<string | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly actionFailed = signal(false);

  readonly islandsResource = resource<LanguageIsland[], unknown>({
    loader: async () => {
      const result = await this.languageIslandsService.listIslands();
      return result ?? [];
    },
  });

  readonly islands = computed(() => this.islandsResource.value() ?? []);

  readonly filteredIslands = computed(() => {
    const filter = this.selectedLanguage();
    const all = this.islands();
    if (filter === 'all') {
      return all;
    }
    return all.filter((island) =>
      island.language_pair.toLowerCase().startsWith(filter.toLowerCase()),
    );
  });

  selectLanguage(lang: string): void {
    this.selectedLanguage.set(lang);
  }

  async enterIsland(island: LanguageIsland): Promise<void> {
    this.actionFailed.set(false);
    try {
      await this.languageIslandsService.joinIsland(island.id);
    } catch {
      this.actionFailed.set(true);
      return;
    }
    this.enteredIslandId.set(island.id);
    this.statusMessage.set(island.name);
  }

  async leaveIsland(island: LanguageIsland): Promise<void> {
    this.actionFailed.set(false);
    try {
      await this.languageIslandsService.leaveIsland(island.id);
    } catch {
      this.actionFailed.set(true);
      return;
    }
    if (this.enteredIslandId() === island.id) {
      this.enteredIslandId.set(null);
    }
    this.statusMessage.set(null);
  }

  retry(): void {
    this.islandsResource.reload();
  }

  getFlag(pair: string): string {
    const primary = pair.split('-')[0]?.toLowerCase();
    switch (primary) {
      case 'ja':
        return '🇯🇵';
      case 'es':
        return '🇪🇸';
      case 'ar':
        return '🇸🇦';
      case 'fr':
        return '🇫🇷';
      case 'de':
        return '🇩🇪';
      case 'zh':
        return '🇨🇳';
      case 'ko':
        return '🇰🇷';
      case 'it':
        return '🇮🇹';
      case 'pt':
        return '🇵🇹';
      case 'ru':
        return '🇷🇺';
      default:
        return '🌐';
    }
  }
}
