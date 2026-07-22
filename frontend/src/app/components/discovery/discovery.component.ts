import { Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile } from '../../services/user.service';

@Component({
  selector: 'app-discovery',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.scss'],
})
export class DiscoveryComponent implements OnInit {
  private discoveryService = inject(DiscoveryService);

  readonly partners = signal<UserProfile[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly nativeLanguageOptions = [
    { value: '', label: 'Any native language' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ar', label: 'Arabic' },
    { value: 'ru', label: 'Russian' },
    { value: 'hi', label: 'Hindi' },
    { value: 'tr', label: 'Turkish' },
  ] as const;

  readonly targetLanguageOptions = [
    { value: '', label: 'Any target language' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ar', label: 'Arabic' },
    { value: 'ru', label: 'Russian' },
    { value: 'hi', label: 'Hindi' },
    { value: 'tr', label: 'Turkish' },
  ] as const;

  readonly distanceBandsKm = [10, 25, 50, 100, 250] as const;
  readonly selectedDistanceKm = signal<number>(50);
  readonly selectedNativeLanguage = signal<string>('');
  readonly selectedTargetLanguage = signal<string>('');
  readonly seriousLearnerOnly = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.searchPartners();
  }

  async searchPartners(): Promise<void> {
    this.isLoading.set(true);
    try {
      const results = await this.discoveryService.findPartners({
        radius_metres: this.selectedDistanceKm() * 1000,
        native_language: this.selectedNativeLanguage() || undefined,
        target_language: this.selectedTargetLanguage() || undefined,
        serious_learner_only: this.seriousLearnerOnly(),
      });
      this.partners.set(results);
    } catch (e) {
      console.error('Partner search failed:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  resetFilters(): void {
    this.selectedDistanceKm.set(50);
    this.selectedNativeLanguage.set('');
    this.selectedTargetLanguage.set('');
    this.seriousLearnerOnly.set(false);
    void this.searchPartners();
  }
}
