import { Component, inject, input } from '@angular/core';

import { ReportUserModalService } from './report-user-modal.service';

@Component({
  selector: 'app-report-button',
  standalone: true,
  imports: [],
  template: `
    <button
      (click)="openReportModal()"
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                   text-red-400 hover:text-red-300 hover:bg-red-500/10
                   border border-red-500/30 hover:border-red-500/50
                   transition-all duration-200 text-sm font-medium"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        />
      </svg>
      Report
    </button>
  `,
})
export class ReportButtonComponent {
  readonly userId = input.required<string>();
  private readonly reportModalService = inject(ReportUserModalService);

  openReportModal(): void {
    this.reportModalService.open(this.userId());
  }
}
