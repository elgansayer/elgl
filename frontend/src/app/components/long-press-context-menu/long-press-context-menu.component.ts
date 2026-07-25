import {
  Component,
  Input,
  Output,
  EventEmitter,
  input,
  signal,
  effect,
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
          <!-- More actions can be added here -->
        </ul>
      </div>
    }

    <!-- Report modal -->
    @if (showReportModal) {
      <app-report-user-modal
        [reportUserId]="messageAuthorId ?? ''"
        [contextUrl]="buildContextUrl()"
        (closed)="showReportModal = false"
        (submitted)="onReportSubmitted($event)"
      />
    }
  `,
  styles: [
    // Styles are kept minimal here; adjust as needed.
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
  /** ID of the message that was long‑pressed */
  readonly messageId = input<string>('');

  /** ID of the author of that message – used to report */
  @Input() messageAuthorId?: string;

  @Output() actionTriggered = new EventEmitter<string>();

  /** Controls visibility of the context menu (supplied by parent) */
  readonly showMenu = input<boolean>(false);

  // ---- Report integration ------------------------------------
  showReportModal = false;
  selectedReportMessageId?: string;
  // -------------------------------------------------------------

  // -----------------------------------------------------------------
  // Action handler
  // -----------------------------------------------------------------
  onAction(action: string): void {
    if (action === 'report') {
      this.selectedReportMessageId = this.messageId();
      this.showReportModal = true;
      return; // stop other handling, e.g., emitting to parent
    }
    this.actionTriggered.emit(action);
  }

  /**
   * Helper that returns the current URL as context for the report.
   * Override in a derived component if you need more specific information.
   */
  buildContextUrl(): string {
    return window.location.href;
  }

  /** Called when the report modal emits the `submitted` event. */
  onReportSubmitted(event: { reasonCategory: string; description: string }): void {
    // After a successful report the modal is already closed.
    // Optionally notify the parent or show a toast – the modal already handles that.
    console.log('[LongPressContextMenu] Report submitted', event);
  }
}
