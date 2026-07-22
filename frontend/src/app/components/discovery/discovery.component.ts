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

  // Filter criteria
  radiusKm = 50;
  nativeLanguage = '';
  targetLanguage = '';
  seriousLearnerOnly = false;

  async ngOnInit(): Promise<void> {
    await this.searchPartners();
  }

  async searchPartners(): Promise<void> {
    this.isLoading.set(true);
    try {
      const results = await this.discoveryService.findPartners({
        radius_metres: this.radiusKm * 1000,
        native_language: this.nativeLanguage ? this.nativeLanguage.toLowerCase().trim() : undefined,
        target_language: this.targetLanguage ? this.targetLanguage.toLowerCase().trim() : undefined,
        serious_learner_only: this.seriousLearnerOnly,
      });
      this.partners.set(results);
    } catch (e) {
      console.error('Partner search failed:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  resetFilters(): void {
    this.radiusKm = 50;
    this.nativeLanguage = '';
    this.targetLanguage = '';
    this.seriousLearnerOnly = false;
    void this.searchPartners();
  }
}
