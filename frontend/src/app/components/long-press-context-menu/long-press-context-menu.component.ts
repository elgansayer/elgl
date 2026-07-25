import { Component, input, output, signal, computed, HostListener, ElementRef, ViewChild, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { SafetyService } from '../../services/safety.service';
import { ReportModalComponent } from '../report-modal/report-modal.component';

export interface ContextMenuOption {
  id: 'copy' | 'favourite' | 'report' | 'block' | 'unblock';
  label: string;
  icon: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-long-press-context-menu',
  standalone: true,
  imports: [CommonModule, ReportModalComponent],
  template: `
    <div
      class="relative inline-block"
      (contextmenu)="onRightClick($event)"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd()"
      (touchmove)="onTouchMove()"
    >
      <ng-content />

      <div
        *ngIf="isOpen()"
        #menuPanel
        class="fixed z-50"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
        (click)="$event.stopPropagation()"
      >
        <div
          class="bg-gray-900 border border-surface-100 rounded-lg shadow-xl py-1 min-w-[160px] overflow-hidden"
          role="menu"
          [attr.aria-label]="'Context menu'"
        >
          <button
            *ngFor="let option of translatedOptions(); trackBy: trackByOptionId"
            class="w-full flex items-center gap-3 ps-4 pe-4 pt-2.5 pb-2.5 text-sm text-gray-200 hover:bg-surface-200 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            [disabled]="(option.id === 'block' && isSenderBlocked()) || (option.id === 'unblock' && !isSenderBlocked()) || option.disabled"
            (click)="onOptionClick(option.id)"
            role="menuitem"
          >
            <span class="text-base w-5 text-center">{{ option.icon }}</span>
            <span>{{ option.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <app-report-modal
      *ngIf="showReportModal()"
      [targetUserId]="reportPayload()?.senderId ?? ''"
      [contextUrl]="reportUrl()"
      (closed)="onCloseReport()"
      (submitted)="onReportSubmitted()"
    ></app-report-modal>
  `,
  styles: [`
    :host {
      display: inline-block;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  `]
})
export class LongPressContextMenuComponent implements AfterViewInit {
  private readonly elementRef = inject(ElementRef);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);

  @ViewChild('menuPanel') menuPanel!: ElementRef<HTMLElement>;

  readonly messageId = input.required<string>();
  readonly messageContent = input<string>('');
  readonly messageType = input<string>('');
  readonly senderId = input<string>('');
  readonly roomId = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly longPressDuration = input<number>(600);

  readonly copy = output<{ messageId: string; content: string }>();
  readonly favourite = output<{ messageId: string; content: string; messageType: string }>();
  readonly report = output<{ messageId: string; content: string; senderId: string; roomId: string }>();
  readonly block = output<{ senderId: string; blocked: boolean }>();

  readonly isOpen = signal(false);
  readonly position = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  readonly showReportModal = signal(false);
  readonly reportPayload = signal<{ messageId: string; content: string; senderId: string; roomId: string } | null>(null);

  readonly reportUrl = computed(() => {
    const payload = this.reportPayload();
    if (!payload) return '';
    return this.buildReportUrl(payload.messageId, payload.roomId);
  });

  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchMoved = false;

  /** Computed signal that derives blocked status from the reactive safety service. */
  readonly isSenderBlocked = computed(() =>
    this.safetyService.blockedUserIdsSignal().has(this.senderId())
  );

  readonly options = computed<ContextMenuOption[]>(() => {
    const blocked = this.isSenderBlocked();
    const baseOptions: ContextMenuOption[] = [
      { id: 'copy', label: this.i18n.translate('context_menu.copy'), icon: '📋' },
      { id: 'favourite', label: this.i18n.translate('context_menu.favourite'), icon: '⭐' },
      { id: 'report', label: this.i18n.translate('context_menu.report'), icon: '🚩' },
    ];

    if (this.senderId()) {
      baseOptions.push({
        id: blocked ? 'unblock' : 'block',
        label: blocked
          ? this.i18n.translate('context_menu.unblock')
          : this.i18n.translate('context_menu.block'),
        icon: blocked ? '🔓' : '🔒',
      });
    }

    return baseOptions;
  });

  readonly translatedOptions = computed(() => this.options());

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.menuPanel?.nativeElement) {
        const rect = this.menuPanel.nativeElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let x = this.position().x;
        let y = this.position().y;

        if (x + rect.width > viewportWidth) {
          x = viewportWidth - rect.width - 8;
        }
        if (y + rect.height > viewportHeight) {
          y = viewportHeight - rect.height - 8;
        }
        if (x < 0) x = 8;
        if (y < 0) y = 8;

        this.position.set({ x, y });
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen()) {
      const target = event.target as HTMLElement;
      const hostElement = this.elementRef.nativeElement as HTMLElement;
      if (!hostElement.contains(target)) {
        this.close();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  onRightClick(event: MouseEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.openAt(event.clientX, event.clientY);
  }

  onTouchStart(event: TouchEvent): void {
    if (this.disabled()) return;
    this.touchMoved = false;
    this.longPressTimer = setTimeout(() => {
      if (!this.touchMoved) {
        event.preventDefault();
        const touch = event.touches[0];
        this.openAt(touch.clientX, touch.clientY);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, this.longPressDuration());
  }

  onTouchEnd(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  onTouchMove(): void {
    this.touchMoved = true;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private openAt(x: number, y: number): void {
    this.position.set({ x, y });
    this.isOpen.set(true);
  }

  onOptionClick(optionId: string): void {
    const id = this.messageId();
    const content = this.messageContent();
    const msgType = this.messageType();
    const sId = this.senderId();
    const rId = this.roomId();
    switch (optionId) {
      case 'copy':
        this.copy.emit({ messageId: id, content });
        break;
      case 'favourite':
        this.favourite.emit({ messageId: id, content, messageType: msgType });
        break;
      case 'report':
        this.close();
        this.reportPayload.set({ messageId: id, content, senderId: sId, roomId: rId });
        this.showReportModal.set(true);
        break;
      case 'block':
        this.block.emit({ senderId: sId, blocked: true });
        break;
      case 'unblock':
        this.block.emit({ senderId: sId, blocked: false });
        break;
    }
    if (optionId !== 'report') {
      this.close();
    }
  }

  onCloseReport(): void {
    this.showReportModal.set(false);
    this.reportPayload.set(null);
  }

  onReportSubmitted(): void {
    const payload = this.reportPayload();
    if (payload) {
      this.report.emit(payload);
    }
    this.onCloseReport();
  }

  showMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.position.set({ x: event.clientX, y: event.clientY });
    this.isOpen.set(true);
  }

  closeMenu(): void {
    this.isOpen.set(false);
  }

  private close(): void {
    this.isOpen.set(false);
  }

  private buildReportUrl(messageId: string, roomId: string): string {
    return `/chat/${roomId}/messages/${messageId}`;
  }

  trackByOptionId(_index: number, option: ContextMenuOption): string {
    return option.id;
  }
}
