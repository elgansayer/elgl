import {
  Component,
  Input,
  Output,
  EventEmitter,
  input,
  model,
  signal,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportUserModalComponent } from '../report-user-modal/report-user-modal.component';
import { SafetyService } from '../../services/safety.service';
import { ToastService } from '../primitives/toast/toast.service';

@Component({
  selector: 'app-long-press-context-menu',
  standalone: true,
  imports: [CommonModule, ReportUserModalComponent],
  template: `
    @if (showMenu()) {
      <div class="context-menu-popup" (click)="$event.stopPropagation()" (contextmenu)="$event.preventDefault()">
        <ul class="menu-items">
          <li>
            <button type="button" role="menuitem" (click)="onOptionClick('copy')" [disabled]="disabled()">Copy</button>
          </li>
          <li>
            <button type="button" role="menuitem" (click)="onOptionClick('favourite')" [disabled]="disabled()">Favourite</button>
          </li>
          <li>
            <button type="button" role="menuitem" (click)="onOptionClick('report')" [disabled]="disabled()">Report</button>
          </li>
        </ul>
      </div>
    }
    <app-report-user-modal
      [reportUserId]="senderId()"
      [contextUrl]="buildContextUrl()"
      [show]="showReportModal"
      (closed)="showReportModal = false"
      (submitted)="onReportSubmitted($event)">
    </app-report-user-modal>
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
      .menu-items button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class LongPressContextMenuComponent {
  readonly messageId = input<string>('');
  readonly messageContent = input<string>('');
  readonly messageType = input<string>('text');
  readonly senderId = input<string>('');
  readonly roomId = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly longPressDuration = input<number>(600);

  showMenu = model(false);
  position = signal({ x: 0, y: 0 });

  @Input() messageAuthorId?: string;

  @Output() copy = new EventEmitter<{ messageId: string; content: string }>();
  @Output() favourite = new EventEmitter<{ messageId: string; content: string; messageType: string }>();
  @Output() report = new EventEmitter<{ messageId: string; content: string; senderId: string; roomId: string }>();

  showReportModal = false;
  longPressTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private elementRef: ElementRef,
    private safetyService: SafetyService,
    private toastService: ToastService,
  ) {}

  onOptionClick(option: string): void {
    if (option === 'copy') {
      this.copy.emit({ messageId: this.messageId(), content: this.messageContent() });
    } else if (option === 'favourite') {
      this.favourite.emit({
        messageId: this.messageId(),
        content: this.messageContent(),
        messageType: this.messageType(),
      });
    } else if (option === 'report') {
      // Close context menu and open the report modal
      this.close();
      this.showReportModal = true;
      return;
    }
    this.close();
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.position.set({ x: event.clientX, y: event.clientY });
    this.showMenu.set(true);
  }

  onTouchStart(event: TouchEvent): void {
    this.clearLongPressTimer();
    const touch = event.touches[0];
    if (touch) {
      this.longPressTimer = setTimeout(() => {
        this.position.set({ x: touch.clientX, y: touch.clientY });
        this.showMenu.set(true);
        this.longPressTimer = null;
      }, this.longPressDuration());
    }
  }

  onTouchMove(): void {
    this.clearLongPressTimer();
  }

  onTouchEnd(): void {
    this.clearLongPressTimer();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement?.contains(event.target);
    if (!clickedInside) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.close();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.close();
  }

  close(): void {
    this.showMenu.set(false);
    this.clearLongPressTimer();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  buildContextUrl(): string {
    return window.location.href;
  }

  async onReportSubmitted(payload: { reasonCategory: string; description: string }): Promise<void> {
    const reportedUserId = this.senderId();
    if (!reportedUserId) {
      this.toastService.show('Cannot report: missing user information.', { type: 'error', duration: 3000 });
      this.showReportModal = false;
      return;
    }
    try {
      await this.safetyService.reportUserAsync({
        reported_id: reportedUserId,
        reason_category: payload.reasonCategory,
        description: payload.description || undefined,
        context_url: this.buildContextUrl(),
      });
      this.toastService.show('Thanks for your report!', { type: 'success', duration: 3000 });
      // Emit the original report event so parent components can react
      this.report.emit({
        messageId: this.messageId(),
        content: this.messageContent(),
        senderId: this.senderId(),
        roomId: this.roomId(),
      });
    } catch {
      this.toastService.show('Failed to submit report', { type: 'error', duration: 5000 });
    } finally {
      this.showReportModal = false;
    }
  }
}
