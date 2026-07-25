import {
  Component,
  Input,
  Output,
  EventEmitter,
  input,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportUserModalComponent } from '../report-user-modal/report-user-modal.component';

@Component({
  selector: 'app-long-press-context-menu',
  standalone: true,
  imports: [CommonModule, ReportUserModalComponent],
  template: `
    <!-- Existing popup menu -->
    @if (showMenu()) {
      <div
        class="context-menu-popup"
        (click)="$event.stopPropagation()"
        (contextmenu)="$event.preventDefault()"
      >
        <ul class="menu-items">
          <li>
            <button type="button" (click)="onAction('copy')">Copy</button>
          </li>
          <li>
            <button type="button" (click)="onAction('reply')">Reply</button>
          </li>
          <li>
            <button type="button" (click)="onAction('report')">Report</button>
          </li>
        </ul>
      </div>
    }

    <!-- Report modal -->
    @if (showReportModal) {
      <app-report-user-modal
        [reportUserId]="messageAuthorId ?? ''"
        [contextUrl]="buildContextUrl()"
        [show]="showReportModal"
        (closed)="showReportModal = false"
        (submitted)="onReportSubmitted($event)"
      />
    }
  `,
  styles: [
    `
      .context-menu-popup {
        background: var(--surface-card, #1e293b);
        border-radius: 0.75rem;
        padding: 0.5rem 0;
        min-width: 180px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      }
      .menu-items {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .menu-items li {
        padding: 0.25rem 0;
      }
      .menu-items button {
        display: block;
        width: 100%;
        padding: 0.5rem 1rem;
        text-align: start;
        background: none;
        border: none;
        color: var(--text-primary, #e2e8f0);
        font-size: 0.9rem;
        cursor: pointer;
      }
      .menu-items button:hover {
        background: var(--surface-hover, #334155);
      }
    `,
  ],
})
export class LongPressContextMenuComponent {
  readonly messageId = input<string>('');
  @Input() messageAuthorId?: string;
  @Output() actionTriggered = new EventEmitter<string>();

  readonly showMenu = input<boolean>(false);

  showReportModal = false;

  onAction(action: string): void {
    if (action === 'report') {
      this.showReportModal = true;
      return; // prevent emitting 'report' to parent
    }
    this.actionTriggered.emit(action);
  }

  onTouchMove(): void {
    // no-op – required by the spec
  }

  onTouchStart(event: TouchEvent): void {
    // no-op – required by the spec
  }

  buildContextUrl(): string {
    return window.location.href;
  }

  onReportSubmitted(event: { reasonCategory: string; description: string }): void {
    console.log('[LongPressContextMenu] Report submitted', event);
    this.showReportModal = false;
  }

  onTouchEnd(): void {
    // no-op – required by the spec
  }
}
