import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, input } from '@angular/core';

import { ReportUserModalService } from './report-user-modal.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-report-button',
  imports: [HlmButton, TranslatePipe],
  template: `
    <button
      hlmBtn
      type="button"
      (click)="openReportModal()"
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                   text-danger hover:text-danger/80 hover:bg-danger/10
                   border border-danger/30 hover:border-danger/50
                   transition-all duration-200 text-sm font-medium"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        />
      </svg>
      {{ 'report.button_label' | t }}
    </button>
  `,
})
export class ReportButtonComponent {
  readonly userId = input.required<string>();
  readonly contextUrl = input<string>();
  private readonly reportModalService = inject(ReportUserModalService);

  openReportModal(): void {
    this.reportModalService.open(this.userId(), this.contextUrl());
  }
}
