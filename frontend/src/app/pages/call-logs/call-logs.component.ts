import { HlmButton } from '@spartan-ng/helm/button';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { Component, inject, computed, signal, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { CallLogRecord, CallLogsService } from '../../services/call-logs.service';

@Component({
  selector: 'app-call-logs',
  imports: [HlmButton, ...HlmEmptyImports, CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="p-4">
      <h1 class="text-2xl font-bold mb-4">
        {{ 'call_logs.title' | t }}
      </h1>

      <div class="flex gap-2 mb-4">
        <button
          hlmBtn
          class="px-3 py-1 rounded-full"
          [class.bg-primary-500]="selectedCallType() === undefined"
          [class.bg-surface]="selectedCallType() !== undefined"
          (click)="onFilterChange(undefined)"
        >
          {{ 'call_logs.all' | t }}
        </button>
        <button
          hlmBtn
          class="px-3 py-1 rounded-full"
          [class.bg-primary-500]="selectedCallType() === 'incoming'"
          [class.bg-surface]="selectedCallType() !== 'incoming'"
          (click)="onFilterChange('incoming')"
        >
          {{ 'call_logs.incoming' | t }}
        </button>
        <button
          hlmBtn
          class="px-3 py-1 rounded-full"
          [class.bg-primary-500]="selectedCallType() === 'outgoing'"
          [class.bg-surface]="selectedCallType() !== 'outgoing'"
          (click)="onFilterChange('outgoing')"
        >
          {{ 'call_logs.outgoing' | t }}
        </button>
        <button
          hlmBtn
          class="px-3 py-1 rounded-full"
          [class.bg-primary-500]="selectedCallType() === 'missed'"
          [class.bg-surface]="selectedCallType() !== 'missed'"
          (click)="onFilterChange('missed')"
        >
          {{ 'call_logs.missed' | t }}
        </button>
      </div>

      @if (callLogsResource.isLoading()) {
        <p role="status" aria-live="polite">{{ 'common.loading' | t }}</p>
      } @else if (callLogsResource.error()) {
        <section hlmEmpty aria-labelledby="call-logs-error-title">
          <div hlmEmptyHeader>
            <h2 hlmEmptyTitle id="call-logs-error-title">{{ 'call_logs.loadErrorTitle' | t }}</h2>
            <p hlmEmptyDescription>{{ 'call_logs.loadErrorDescription' | t }}</p>
          </div>
          <div hlmEmptyContent>
            <button hlmBtn size="touch" type="button" (click)="retryCallLogs()">
              {{ 'call_logs.retry' | t }}
            </button>
          </div>
        </section>
      } @else if (logs().length === 0) {
        <section hlmEmpty aria-labelledby="call-logs-empty-title">
          <div hlmEmptyHeader>
            <span hlmEmptyMedia class="text-4xl" aria-hidden="true">📞</span>
            <h2 hlmEmptyTitle id="call-logs-empty-title">{{ 'call_logs.emptyTitle' | t }}</h2>
            <p hlmEmptyDescription>{{ 'call_logs.emptyDesc' | t }}</p>
          </div>
          <div hlmEmptyContent>
            <a hlmBtn size="touch" routerLink="/discovery">{{ 'call_logs.emptyAction' | t }}</a>
          </div>
        </section>
      } @else {
        <ul class="space-y-2">
          @for (log of logs(); track log.id) {
            <li class="flex items-center gap-3 p-3 rounded-xl bg-surface">
              <div class="flex-1 min-w-0">
                <p class="truncate font-semibold">
                  {{ log.caller_name }} → {{ log.receiver_name }}
                </p>
                <p class="text-sm text-surface-400">
                  {{ 'call_logs.' + log.call_type | t }}
                  · {{ log.started_at | date: 'short' }}
                  @if (log.duration_seconds !== null) {
                    · {{ log.duration_seconds }}s
                  }
                </p>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class CallLogsComponent {
  private callLogsService = inject(CallLogsService);
  selectedCallType = signal<string | undefined>(undefined);

  readonly callLogsResource = resource<CallLogRecord[], { callType?: string }>({
    params: () => ({ callType: this.selectedCallType() }),
    loader: ({ params }) => this.callLogsService.getCallLogs({ callType: params.callType }),
  });

  logs = computed<CallLogRecord[]>(() => this.callLogsResource.value() ?? []);

  onFilterChange(callType?: string): void {
    this.selectedCallType.set(callType);
  }

  retryCallLogs(): void {
    this.callLogsResource.reload();
  }
}
