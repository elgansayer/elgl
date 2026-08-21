import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { Component, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyStore } from '../../services/economy.store';
import { SafetyService, ReportCategory } from '../../services/safety.service';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-trust-safety-modal',
  imports: [
    HlmNativeSelect,
    FormsModule,
    TranslatePipe,
    AppSkeletonLoaderComponent,
    ...HlmButtonImports,
    ...HlmDialogImports,
    ...HlmTextareaImports,
  ],
  template: `
    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="w-full max-w-md space-y-5 rounded-3xl border border-surface-100 bg-surface-200 p-6 shadow-2xl"
        aria-labelledby="trust-safety-title"
        aria-describedby="trust-safety-description"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3
              id="trust-safety-title"
              class="flex items-center gap-2 text-xl font-black text-text-primary"
            >
              {{ 'safety.title' | t }}
            </h3>
            <p id="trust-safety-description" class="text-xs text-text-secondary">
              {{ 'safety.subtitle' | t: { name: targetName() } }}
            </p>
          </div>
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="icon-touch"
            (click)="closed.emit()"
            [attr.aria-label]="'safety.closeBtn' | t"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div
          class="flex gap-1 rounded-2xl bg-surface-100 p-1"
          role="tablist"
          [attr.aria-label]="'safety.tabListLabel' | t"
        >
          <button
            hlmBtn
            id="trust-safety-tab-report"
            type="button"
            variant="ghost"
            size="sm"
            class="flex-1 rounded-xl"
            role="tab"
            [attr.aria-selected]="mode() === 'report'"
            [attr.aria-controls]="'trust-safety-panel-report'"
            [attr.tabindex]="mode() === 'report' ? 0 : -1"
            [class.bg-surface-200]="mode() === 'report'"
            [class.text-primary]="mode() === 'report'"
            (click)="switchTab('report')"
            (keydown)="onTabKeydown($event, 'report')"
          >
            {{ 'safety.tabReport' | t }}
          </button>
          <button
            hlmBtn
            id="trust-safety-tab-block"
            type="button"
            variant="ghost"
            size="sm"
            class="flex-1 rounded-xl"
            role="tab"
            [attr.aria-selected]="mode() === 'block'"
            [attr.aria-controls]="'trust-safety-panel-block'"
            [attr.tabindex]="mode() === 'block' ? 0 : -1"
            [class.bg-danger]="mode() === 'block'"
            [class.text-on-fill]="mode() === 'block'"
            (click)="switchTab('block')"
            (keydown)="onTabKeydown($event, 'block')"
          >
            {{ 'safety.tabBlock' | t }}
          </button>
        </div>

        @if (mode() === 'report') {
          <div
            id="trust-safety-panel-report"
            role="tabpanel"
            tabindex="0"
            aria-labelledby="trust-safety-tab-report"
            class="space-y-3 text-xs"
          >
            @if (categoriesLoading()) {
              <div
                class="space-y-2"
                aria-busy="true"
                [attr.aria-label]="'safety.categoriesLoading' | t"
              >
                <app-skeleton-loader [height]="'12px'" [width]="'60%'" [variant]="'text'" />
                <app-skeleton-loader [height]="'36px'" [width]="'100%'" [borderRadius]="'12px'" />
              </div>
            } @else {
              <div>
                <label
                  for="report-reason-select"
                  class="mb-1 block ps-1 font-bold text-text-primary"
                  >{{ 'safety.reasonLabel' | t }}</label
                >
                <hlm-native-select
                  selectId="report-reason-select"
                  [(ngModel)]="reportReason"
                  aria-required="true"
                  class="w-full rounded-xl border bg-surface-300 px-3 py-2 font-medium"
                  selectClass="w-full rounded-xl border bg-surface-300 px-3 py-2 font-medium"
                >
                  @for (category of reportCategories(); track category.value) {
                    <option [value]="category.value">{{ category.label }}</option>
                  }
                </hlm-native-select>
              </div>
            }
            <div>
              <label
                for="report-details-textarea"
                class="mb-1 block ps-1 font-bold text-text-primary"
                >{{ 'safety.detailsLabel' | t }}</label
              >
              <textarea
                hlmTextarea
                id="report-details-textarea"
                [(ngModel)]="reportDetails"
                rows="3"
                [placeholder]="'safety.detailsPlaceholder' | t"
              ></textarea>
            </div>
          </div>
        } @else {
          <div
            id="trust-safety-panel-block"
            role="tabpanel"
            tabindex="0"
            aria-labelledby="trust-safety-tab-block"
          >
            <div
              class="space-y-2 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-xs"
              role="alert"
            >
              <span class="block font-bold text-danger">{{
                'safety.blockWarning' | t: { name: targetName() }
              }}</span>
              <ul class="list-inside list-disc space-y-1 text-text-primary">
                <li>{{ 'safety.blockList1' | t }}</li>
                <li>{{ 'safety.blockList2' | t }}</li>
                <li>{{ 'safety.blockList3' | t }}</li>
              </ul>
            </div>
          </div>
        }

        <div class="flex justify-end gap-3 border-t border-surface-100 pt-2">
          <button hlmBtn type="button" variant="secondary" size="touch" (click)="closed.emit()">
            {{ 'safety.cancelBtn' | t }}
          </button>
          @if (mode() === 'report') {
            <button
              hlmBtn
              type="button"
              size="touch"
              (click)="submitReport()"
              [attr.aria-label]="'safety.submitReportAria' | t: { name: targetName() }"
            >
              {{ 'safety.submitReportBtn' | t }}
            </button>
          } @else {
            <button
              hlmBtn
              type="button"
              variant="destructive-solid"
              size="touch"
              (click)="confirmBlock()"
              [attr.aria-label]="'safety.confirmBlockAria' | t: { name: targetName() }"
            >
              {{ 'safety.confirmBlockBtn' | t }}
            </button>
          }
        </div>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class TrustSafetyModalComponent {
  readonly targetId = input.required<string>();
  readonly targetName = input.required<string>();
  readonly open = input(true);
  readonly closed = output<void>();

  readonly store = inject(EconomyStore);
  private readonly safetyService = inject(SafetyService);
  readonly mode = signal<'report' | 'block'>('report');
  readonly dialogState = computed<HlmDialogState>(() => (this.open() ? 'open' : 'closed'));
  reportReason = 'harassment';
  reportDetails = '';
  readonly categoriesLoading = signal(false);
  readonly reportCategories = signal<ReportCategory[]>([
    { value: 'harassment', label: 'Harassment / Bullying' },
    { value: 'spam', label: 'Spam / Commercial Advertising' },
    { value: 'inappropriate', label: 'Inappropriate / Offensive Language' },
    { value: 'scam', label: 'Suspicious Link / Scam' },
    { value: 'other', label: 'Other Violation' },
  ]);

  constructor() {
    void this.loadCategories();
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.open()) this.closed.emit();
  }

  private async loadCategories(): Promise<void> {
    this.categoriesLoading.set(true);
    try {
      const categories = await this.safetyService.getReportCategories();
      if (categories.length > 0) this.reportCategories.set(categories);
    } catch {
      // Default categories remain available when the service is unavailable.
    } finally {
      this.categoriesLoading.set(false);
    }
  }

  switchTab(tab: 'report' | 'block'): void {
    this.mode.set(tab);
  }

  onTabKeydown(event: KeyboardEvent, currentTab: 'report' | 'block'): void {
    const tabs: Array<'report' | 'block'> = ['report', 'block'];
    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      this.mode.set(tabs[nextIndex]);
      queueMicrotask(() => document.getElementById(`trust-safety-tab-${tabs[nextIndex]}`)?.focus());
    }
  }

  async submitReport(): Promise<void> {
    await this.store.reportUser(this.targetId(), this.reportReason, this.reportDetails);
    this.closed.emit();
  }

  async confirmBlock(): Promise<void> {
    await this.store.blockUser(this.targetId());
    this.closed.emit();
  }
}
