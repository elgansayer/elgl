import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCheckCheck } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { ChatService } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

type DeliveryStatus = 'sent' | 'delivered' | 'read';

/**
 * Delivery and read status of one of the current user's own messages.
 *
 * The status is announced with a translated accessible name and is never
 * carried by colour alone: the tick count separates sent from delivered, and
 * read is drawn heavier and can show a visible label (`showLabel`). In group
 * chats the indicator opens a popover listing who has read the message; only
 * the sender may fetch that list and it only contains members who enabled read
 * receipts.
 */
@Component({
  selector: 'app-read-receipt',
  imports: [DatePipe, NgTemplateOutlet, NgIcon, TranslatePipe, HlmButton, ...HlmPopoverImports],
  providers: [provideIcons({ lucideCheck, lucideCheckCheck })],
  host: { class: 'inline-flex items-center' },
  template: `
    @if (status(); as current) {
      <ng-template #indicator>
        <ng-icon
          [name]="current === 'sent' ? 'lucideCheck' : 'lucideCheckCheck'"
          size="14px"
          [strokeWidth]="current === 'read' ? 3 : 2"
          aria-hidden="true"
        />
        @if (showLabel()) {
          <span class="text-[11px]" [class.font-semibold]="current === 'read'">{{ label() }}</span>
        }
      </ng-template>

      @if (hasDetails()) {
        <hlm-popover (stateChanged)="onPopoverState($event)">
          <button
            hlmPopoverTrigger
            hlmBtn
            type="button"
            variant="ghost"
            size="xs"
            class="relative h-auto min-h-6 min-w-6 gap-1 px-1 py-0.5 text-inherit after:absolute after:-inset-2 after:content-['']"
            data-testid="read-receipt-details"
            [attr.aria-label]="detailsLabel()"
          >
            <ng-container [ngTemplateOutlet]="indicator" />
          </button>
          <ng-template hlmPopoverPortal>
            <hlm-popover-content class="w-64 text-text-primary">
              <hlm-popover-header>
                <h4 hlmPopoverTitle>{{ 'readReceipts.readByTitle' | t }}</h4>
                @if (summary(); as counts) {
                  <p class="text-xs text-text-secondary">
                    {{
                      'readReceipts.readByCount'
                        | t: { read: counts.readBy.length, total: counts.totalMembers }
                    }}
                  </p>
                }
              </hlm-popover-header>

              @if (receipts.isLoading()) {
                <p role="status" class="text-sm text-text-secondary">
                  {{ 'readReceipts.loading' | t }}
                </p>
              } @else if (receipts.error()) {
                <div role="alert" class="flex flex-col items-start gap-2">
                  <p class="text-sm">{{ 'readReceipts.loadError' | t }}</p>
                  <button
                    hlmBtn
                    type="button"
                    variant="outline"
                    size="xs"
                    (click)="receipts.reload()"
                  >
                    {{ 'common.retry' | t }}
                  </button>
                </div>
              } @else if (summary(); as data) {
                <ul class="flex max-h-48 flex-col gap-2 overflow-y-auto">
                  @for (reader of data.readBy; track reader.userId) {
                    <li class="flex items-center gap-2">
                      @if (reader.avatarUrl) {
                        <img
                          [src]="reader.avatarUrl"
                          alt=""
                          loading="lazy"
                          class="size-6 shrink-0 rounded-full object-cover"
                        />
                      } @else {
                        <span
                          class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-bold"
                          aria-hidden="true"
                        >
                          {{ initial(reader.displayName) }}
                        </span>
                      }
                      <span class="min-w-0 flex-1 truncate text-sm">
                        {{ reader.displayName || ('readReceipts.unknownReader' | t) }}
                      </span>
                      <time
                        class="shrink-0 text-xs text-text-muted"
                        [attr.datetime]="reader.readAt"
                      >
                        {{ reader.readAt | date: 'shortTime' }}
                      </time>
                    </li>
                  } @empty {
                    <li class="text-sm text-text-secondary">{{ 'readReceipts.nobodyYet' | t }}</li>
                  }
                </ul>
                <p class="text-xs text-text-muted">{{ 'readReceipts.privacyNote' | t }}</p>
              }
            </hlm-popover-content>
          </ng-template>
        </hlm-popover>
      } @else {
        <span role="img" class="inline-flex items-center gap-1" [attr.aria-label]="label()">
          <ng-container [ngTemplateOutlet]="indicator" />
        </span>
      }
    }
  `,
})
export class ReadReceiptComponent {
  private readonly chatService = inject(ChatService);
  private readonly i18n = inject(I18nService);

  readonly messageId = input.required<string>();
  readonly deliveryStatus = input<DeliveryStatus | undefined>();
  /** Group rooms show who has read a message; one-to-one rooms only show the status. */
  readonly isGroup = input(false);
  /** Shows the status as visible text next to the ticks, for example on the latest message. */
  readonly showLabel = input(false);

  protected readonly status = computed(() => this.deliveryStatus() ?? null);

  protected readonly hasDetails = computed(() => this.isGroup() && this.status() !== 'sent');

  protected readonly label = computed(() => {
    switch (this.status()) {
      case 'read':
        return this.i18n.translate(this.isGroup() ? 'readReceipts.readByAll' : 'readReceipts.read');
      case 'delivered':
        return this.i18n.translate('readReceipts.delivered');
      case 'sent':
        return this.i18n.translate('readReceipts.sent');
      default:
        return '';
    }
  });

  protected readonly detailsLabel = computed(() =>
    this.i18n.translate('readReceipts.detailsButton', { status: this.label() }),
  );

  private readonly detailsOpen = signal(false);

  /** Fetched fresh every time the popover opens, so counts are never stale. */
  protected readonly receipts = resource({
    params: () => (this.detailsOpen() ? this.messageId() : undefined),
    loader: ({ params: messageId }) => this.chatService.getMessageReceipts(messageId),
  });

  /** `value()` throws while a resource is in an error state, so read it through this guard. */
  protected readonly summary = computed(() =>
    this.receipts.hasValue() ? this.receipts.value() : null,
  );

  protected onPopoverState(state: 'open' | 'closed'): void {
    this.detailsOpen.set(state === 'open');
  }

  protected initial(name: string): string {
    return Array.from(name.trim())[0]?.toLocaleUpperCase(this.i18n.currentLang()) ?? '';
  }
}
