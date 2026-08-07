import {Component, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AdminService } from '../../services/admin.service';
import { showToast, showErrorToast } from '../../services/toast.service';
import {
  ModerationService,
  ModerationItem,
  UserAnalysisResult,
} from '../../services/moderation.service';

@Component({
  selector: 'app-moderation-panel',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './moderation-panel.html',
})
export class ModerationPanelComponent {
  private readonly moderationService = inject(ModerationService);
  private readonly adminService = inject(AdminService);
  private readonly i18n = inject(I18nService);

  currentFilter = signal<'moment' | 'profile'>('moment');
  items = signal<ModerationItem[]>([]);
  loading = signal(false);
  analysisResult = signal<UserAnalysisResult | null>(null);
  analysing = signal(false);
  moderatingUserId = signal<string | null>(null);

  constructor() {
    this.loadItems();
  }

  filterByType(type: 'moment' | 'profile') {
    this.currentFilter.set(type);
    this.loadItems();
  }

  private async loadItems() {
    this.loading.set(true);
    try {
      const items = await this.moderationService.getItems(this.currentFilter());
      this.items.set(items);
    } finally {
      this.loading.set(false);
    }
  }

  async approve(item: ModerationItem) {
    await this.moderationService.approveItem(item.id, item.type);
    this.loadItems();
  }

  async reject(item: ModerationItem) {
    await this.moderationService.rejectItem(item.id, item.type);
    this.loadItems();
  }

  async banReportedUser(userId: string) {
    if (!userId || this.moderatingUserId()) return;
    this.moderatingUserId.set(userId);
    try {
      await this.adminService.banUser(userId);
      showToast(this.i18n.translate('admin.userBanned'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.banFailed'));
    } finally {
      this.moderatingUserId.set(null);
    }
  }

  async warnReportedUser(userId: string) {
    if (!userId || this.moderatingUserId()) return;
    this.moderatingUserId.set(userId);
    try {
      await this.adminService.warnUser(userId);
      showToast(this.i18n.translate('admin.warningIssued'), 'success');
    } catch {
      showErrorToast(this.i18n.translate('admin.warningFailed'));
    } finally {
      this.moderatingUserId.set(null);
    }
  }

  async analyseUserProfile(userId: string) {
    this.analysing.set(true);
    this.analysisResult.set(null);
    try {
      const result = await this.moderationService.getUserRiskAnalysis(userId);
      this.analysisResult.set(result);
    } finally {
      this.analysing.set(false);
    }
  }
}
