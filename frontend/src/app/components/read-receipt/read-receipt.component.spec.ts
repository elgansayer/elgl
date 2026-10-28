import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgIcon } from '@ng-icons/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { ChatService, MessageReceiptStatus } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';
import { ReadReceiptComponent } from './read-receipt.component';

type Status = 'sent' | 'delivered' | 'read' | undefined;

@Component({
  imports: [ReadReceiptComponent],
  template: `<app-read-receipt
    [messageId]="messageId()"
    [deliveryStatus]="status()"
    [isGroup]="isGroup()"
    [showLabel]="showLabel()"
  />`,
})
class HostComponent {
  readonly messageId = signal('message-1');
  readonly status = signal<Status>('sent');
  readonly isGroup = signal(false);
  readonly showLabel = signal(false);
}

const summary: MessageReceiptStatus = {
  messageId: 'message-1',
  deliveryStatus: 'delivered',
  totalMembers: 3,
  readBy: [
    { userId: 'u2', displayName: 'Aiko', avatarUrl: null, readAt: '2026-09-26T10:01:00.000Z' },
    {
      userId: 'u3',
      displayName: '',
      avatarUrl: 'https://cdn.example/ben.png',
      readAt: '2026-09-26T10:05:00.000Z',
    },
  ],
};

describe('ReadReceiptComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let getMessageReceipts: ReturnType<typeof vi.fn>;

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function indicator(): HTMLElement | null {
    return element().querySelector('[role="img"]');
  }

  function trigger(): HTMLButtonElement | null {
    return element().querySelector('button[data-testid="read-receipt-details"]');
  }

  function iconName(): string | null {
    return fixture.debugElement.query(By.directive(NgIcon))?.componentInstance.name() ?? null;
  }

  function iconStrokeWidth(): unknown {
    return fixture.debugElement.query(By.directive(NgIcon))?.componentInstance.strokeWidth();
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    getMessageReceipts = vi.fn().mockResolvedValue(summary);
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: ChatService, useValue: { getMessageReceipts } },
        { provide: AuthService, useValue: { getAccessToken: () => null } },
        I18nService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.querySelectorAll('.cdk-overlay-container').forEach((node) => node.remove());
  });

  it('renders nothing while the message has no delivery status', () => {
    host.status.set(undefined);
    fixture.detectChanges();

    expect(indicator()).toBeNull();
    expect(trigger()).toBeNull();
    expect(element().querySelector('ng-icon')).toBeNull();
  });

  it('shows a single tick for a sent message with a translated accessible name', () => {
    host.status.set('sent');
    fixture.detectChanges();

    expect(iconName()).toBe('lucideCheck');
    expect(indicator()?.getAttribute('aria-label')).toBe('Sent');
    expect(element().querySelector('ng-icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(trigger()).toBeNull();
  });

  it.each([
    ['delivered', 'Delivered'],
    ['read', 'Read'],
  ] as const)('shows a double tick and the label "%s" in a one-to-one chat', (status, label) => {
    host.status.set(status);
    fixture.detectChanges();

    expect(iconName()).toBe('lucideCheckCheck');
    expect(indicator()?.getAttribute('aria-label')).toBe(label);
    expect(trigger()).toBeNull();
  });

  it('does not rely on colour alone: the label can be shown as visible text and read is drawn heavier', () => {
    host.status.set('delivered');
    fixture.detectChanges();
    expect(element().textContent?.trim()).toBe('');
    expect(iconStrokeWidth()).toBe(2);

    host.showLabel.set(true);
    fixture.detectChanges();
    expect(element().textContent?.trim()).toBe('Delivered');

    host.status.set('read');
    fixture.detectChanges();
    expect(element().textContent?.trim()).toBe('Read');
    expect(element().querySelector('span.font-semibold')).not.toBeNull();
    expect(iconStrokeWidth()).toBe(3);
  });

  it('follows status changes pushed by realtime events', () => {
    host.status.set('sent');
    fixture.detectChanges();
    expect(indicator()?.getAttribute('aria-label')).toBe('Sent');

    host.status.set('read');
    fixture.detectChanges();
    expect(indicator()?.getAttribute('aria-label')).toBe('Read');
  });

  describe('in a group chat', () => {
    beforeEach(() => {
      host.isGroup.set(true);
    });

    it('keeps a sent message a plain indicator because nobody can have read it yet', () => {
      host.status.set('sent');
      fixture.detectChanges();

      expect(trigger()).toBeNull();
      expect(indicator()?.getAttribute('aria-label')).toBe('Sent');
    });

    it('offers who-has-read details as a labelled popover trigger once delivered', () => {
      host.status.set('delivered');
      fixture.detectChanges();

      const button = trigger();
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
      expect(button?.getAttribute('aria-expanded')).toBe('false');
      expect(button?.getAttribute('aria-label')).toBe(
        'Message status: Delivered. Show who has read it.',
      );
    });

    it('names the read state "Read by everyone" for a group', () => {
      host.status.set('read');
      host.showLabel.set(true);
      fixture.detectChanges();

      expect(trigger()?.getAttribute('aria-label')).toContain('Read by everyone');
      expect(element().textContent).toContain('Read by everyone');
    });

    it('does not fetch receipts until the details are opened', async () => {
      host.status.set('delivered');
      await settle();

      expect(getMessageReceipts).not.toHaveBeenCalled();
    });

    it('loads and lists the readers when the popover opens, without exposing avatars as content', async () => {
      host.status.set('delivered');
      await settle();

      trigger()?.click();
      await settle();

      expect(getMessageReceipts).toHaveBeenCalledWith('message-1');
      const overlay = document.body.textContent ?? '';
      expect(overlay).toContain('Read by');
      expect(overlay).toContain('2 of 3 have read this');
      expect(overlay).toContain('Aiko');
      expect(overlay).toContain('Unknown member');
      expect(overlay).toContain('Only people who have turned on read receipts are listed.');
      const avatar = document.body.querySelector('img[src="https://cdn.example/ben.png"]');
      expect(avatar?.getAttribute('alt')).toBe('');
    });

    it('explains an empty list instead of implying nobody received the message', async () => {
      getMessageReceipts.mockResolvedValue({ ...summary, readBy: [] });
      host.status.set('delivered');
      await settle();

      trigger()?.click();
      await settle();

      expect(document.body.textContent).toContain('Nobody has read this yet.');
    });

    it('offers a retry when the receipts cannot be loaded', async () => {
      getMessageReceipts.mockRejectedValueOnce(new Error('offline'));
      host.status.set('delivered');
      await settle();

      trigger()?.click();
      await settle();

      const alert = document.body.querySelector('[role="alert"]');
      expect(alert?.textContent).toContain('Could not load read receipts.');

      getMessageReceipts.mockResolvedValue(summary);
      const retry = alert?.querySelector('button') as HTMLButtonElement;
      retry.click();
      await settle();

      expect(getMessageReceipts).toHaveBeenCalledTimes(2);
      expect(document.body.textContent).toContain('Aiko');
    });
  });
});
