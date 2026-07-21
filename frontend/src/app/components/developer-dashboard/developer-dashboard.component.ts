import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EconomyStore } from '../../services/economy.store';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-developer-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './developer-dashboard.component.html',
  styleUrls: ['./developer-dashboard.component.scss']
})
export class DeveloperDashboardComponent implements OnInit {
  readonly store = inject(EconomyStore);
  readonly authService = inject(AuthService);

  async ngOnInit(): Promise<void> {
    await this.store.loadDeveloperAnalytics();
  }

  async upgrade(tier: 'consumer' | 'developer'): Promise<void> {
    await this.store.upgradeVip(tier);
    await this.store.loadDeveloperAnalytics();
  }

  async generateKey(): Promise<void> {
    await this.store.generateApiKey();
  }
}
