import { showToast, notImplementedToast } from '../../services/toast.service';
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile } from '../../services/user.service';

import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';
import { FluencyIndicatorComponent } from '../primitives/fluency-indicator/fluency-indicator.component';
import { AppGradientButtonComponent } from '../primitives/gradient-button/gradient-button.component';

@Component({
  selector: 'app-discovery',
  imports: [CommonModule, FormsModule, TranslatePipe, ScrollablePillsComponent, FluencyIndicatorComponent, AppGradientButtonComponent],
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.scss'],
})
export class DiscoveryComponent implements OnInit {
  private discoveryService = inject(DiscoveryService);

  readonly partners = signal<UserProfile[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly nativeLanguageOptions = [
    { value: '', labelKey: 'lang.anyNative' },
    { value: 'en', labelKey: 'lang.en' },
    { value: 'es', labelKey: 'lang.es' },
    { value: 'fr', labelKey: 'lang.fr' },
    { value: 'de', labelKey: 'lang.de' },
    { value: 'it', labelKey: 'lang.it' },
    { value: 'pt', labelKey: 'lang.pt' },
    { value: 'ja', labelKey: 'lang.ja' },
    { value: 'ko', labelKey: 'lang.ko' },
    { value: 'zh', labelKey: 'lang.zh' },
    { value: 'ar', labelKey: 'lang.ar' },
    { value: 'ru', labelKey: 'lang.ru' },
    { value: 'hi', labelKey: 'lang.hi' },
    { value: 'tr', labelKey: 'lang.tr' },
  ] as const;

  readonly targetLanguageOptions = [
    { value: '', labelKey: 'lang.anyTarget' },
    { value: 'en', labelKey: 'lang.en' },
    { value: 'es', labelKey: 'lang.es' },
    { value: 'fr', labelKey: 'lang.fr' },
    { value: 'de', labelKey: 'lang.de' },
    { value: 'it', labelKey: 'lang.it' },
    { value: 'pt', labelKey: 'lang.pt' },
    { value: 'ja', labelKey: 'lang.ja' },
    { value: 'ko', labelKey: 'lang.ko' },
    { value: 'zh', labelKey: 'lang.zh' },
    { value: 'ar', labelKey: 'lang.ar' },
    { value: 'ru', labelKey: 'lang.ru' },
    { value: 'hi', labelKey: 'lang.hi' },
    { value: 'tr', labelKey: 'lang.tr' },
  ] as const;

  readonly distanceBandsKm = [10, 25, 50, 100, 250] as const;
  readonly selectedDistanceKm = signal<number>(50);
  readonly selectedNativeLanguage = signal<string>('');
  readonly selectedTargetLanguage = signal<string>('');
  readonly seriousLearnerOnly = signal<boolean>(false);
  
  readonly filterPills = signal([
    { id: 'all', label: 'All' },
    { id: 'serious', label: 'Serious Learners' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'city', label: 'City' },
    { id: 'gender', label: 'Gender' },
    { id: 'paid', label: 'Paid Practice' }
  ]);
  readonly selectedFilter = signal<string>('all');

  onFilterSelect(id: string) {
    this.selectedFilter.set(id);
    if (id === 'serious') {
      this.seriousLearnerOnly.set(true);
      void this.searchPartners();
    } else {
      this.seriousLearnerOnly.set(false);
      if (id === 'all') void this.searchPartners();
      else this.notImplemented();
    }
  }

  getNativeLangs(partner: UserProfile) {
    return [{ code: partner.native_language || 'EN', level: 5 }];
  }

  getTargetLangs(partner: UserProfile) {
    return (partner.target_languages?.length ? partner.target_languages : ['JA']).map(code => ({ code, level: 1 }));
  }

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

  notImplemented(): void {
    notImplementedToast();
  }
}
