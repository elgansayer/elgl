import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  LanguageIsland,
  LanguageIslandsService,
} from '../../services/language-islands.service';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-language-islands',
  imports: [HlmButton, TranslatePipe, AppEmptyStateComponent],
  templateUrl: './language-islands.component.html',
  styleUrl: './language-islands.component.scss',
})
export class LanguageIslandsComponent {
  private readonly languageIslandsService = inject(LanguageIslandsService);
  private readonly i18n = inject(I18nService);

  readonly selectedLanguage = signal<string>('all');
  readonly statusMessage = signal<string | null>(null);
  readonly actionFailed = signal(false);
  readonly busyIslandId = signal<string | null>(null);

  readonly islandsResource = resource<LanguageIsland[], void>({
    loader: () => this.languageIslandsService.listIslands({ limit: 50 }),
  });

  readonly membershipsResource = resource<LanguageIsland[], void>({
    loader: async () => {
      try {
        return await this.languageIslandsService.getMyIslands();
      } catch {
        return [];
      }
    },
  });

  readonly islands = computed(() => {
    if (!this.islandsResource.hasValue()) {
      return [];
    }
    return this.islandsResource.value() ?? [];
  });
  readonly joinedIslandIds = linkedSignal<LanguageIsland[], Set<string>>({
    source: () => this.membershipsResource.value() ?? [],
    computation: (memberships) => new Set(memberships.map((island) => island.id)),
  });

  readonly filteredIslands = computed(() => {
    const filter = this.selectedLanguage();
    if (filter === 'all') {
      return this.islands();
    }
    return this.islands().filter(
      (island) => this.primaryLanguage(island.language_pair) === filter,
    );
  });

  readonly languageFilters = computed(() => {
    const seen = new Set<string>();
    return this.islands().flatMap((island) => {
      const code = this.primaryLanguage(island.language_pair);
      if (!code || seen.has(code)) {
        return [];
      }
      seen.add(code);
      return [{ code, label: this.getLanguageLabel(code) }];
    });
  });

  isJoined(islandId: string): boolean {
    return this.joinedIslandIds().has(islandId);
  }

  selectLanguage(language: string): void {
    this.selectedLanguage.set(language);
  }

  async toggleMembership(island: LanguageIsland): Promise<void> {
    if (this.busyIslandId()) {
      return;
    }

    this.busyIslandId.set(island.id);
    this.actionFailed.set(false);

    try {
      if (this.isJoined(island.id)) {
        await this.languageIslandsService.leaveIsland(island.id);
        this.joinedIslandIds.update((current) => {
          const next = new Set(current);
          next.delete(island.id);
          return next;
        });
        this.statusMessage.set(null);
      } else {
        await this.languageIslandsService.joinIsland(island.id);
        this.joinedIslandIds.update((current) => new Set(current).add(island.id));
        this.statusMessage.set(island.name);
      }
      this.islandsResource.reload();
    } catch {
      this.actionFailed.set(true);
    } finally {
      this.busyIslandId.set(null);
    }
  }

  retry(): void {
    this.islandsResource.reload();
    this.membershipsResource.reload();
  }

  getFlag(languagePair: string): string {
    const primary = this.primaryLanguage(languagePair);
    return (
      this.i18n.availableLanguages.find(
        (language) => language.code.toLowerCase().split('-')[0] === primary,
      )?.flag ?? '🌐'
    );
  }

  getLanguageLabel(code: string): string {
    const names = new Intl.DisplayNames([this.i18n.currentLang()], {
      type: 'language',
    });
    return names.of(code) ?? code.toUpperCase();
  }

  primaryLanguage(languagePair: string): string {
    return languagePair.split('-')[0]?.trim().toLowerCase() ?? '';
  }

  pinPosition(index: number): string {
    const positions = ['18%', '42%', '66%', '30%', '54%', '78%'];
    return positions[index % positions.length] ?? '50%';
  }
}
