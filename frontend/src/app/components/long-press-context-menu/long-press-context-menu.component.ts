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
import { ReportUserDto } from '../../services/safety.service';

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
      [reportedUserId]="senderId()"
      [contextUrl]="buildContextUrl()"
      [show]="showReportModal"
      (closed)="showReportModal = false"
      (reportSent)="onReportSubmitted($event)">
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
    private safetyService: SafetyService
  ) {}

  onOptionClick(option: string): void {
    if (option === 'copy') {
      this.copy.emit({ messageId: this.messageId(), content: this.messageContent() });
      this.close();
    } else if (option === 'favourite') {
      this.favourite.emit({
        messageId: this.messageId(),
        content: this.messageContent(),
        messageType: this.messageType(),
      });
      this.close();
    } else if (option === 'report') {
      this.close();             // close the context menu first
      this.showReportModal = true;
      return;
    }
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

  onReportSubmitted(reportData: { reason_category: string; description?: string }): void {
    const dto: ReportUserDto = {
      reported_id: this.senderId(),
      reason_category: reportData.reason_category,
      description: reportData.description,
      context_url: this.buildContextUrl(),
    };
    this.safetyService.reportUser(dto).subscribe({
      next: () => {
        // Optionally show a success toast
        console.log('Report submitted successfully');
      },
      error: (err) => console.error('Failed to submit report', err)
    });
    this.showReportModal = false;

    // Still emit the parent event for analytics
    this.report.emit({
      messageId: this.messageId(),
      content: this.messageContent(),
      senderId: this.senderId(),
      roomId: this.roomId(),
    });
  }
}
