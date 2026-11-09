import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReadReceiptComponent } from './read-receipt.component';
import { ChatService, MessageReceiptStatus } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';

describe('ReadReceiptComponent', () => {
  let fixture: ComponentFixture<ReadReceiptComponent>;
  let component: ReadReceiptComponent;
  let chatService: { getMessageReceipts: ReturnType<typeof vi.fn> };

  const translate = vi.fn(
    (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : `[${key}]`,
  );

  const receiptStatus: MessageReceiptStatus = {
    messageId: 'message-1',
    deliveryStatus: 'read',
    readBy: [
      {
        userId: 'user-2',
        displayName: 'Partner',
        avatarUrl: '/partner.png',
        readAt: new Date().toISOString(),
      },
      {
        userId: 'user-3',
        displayName: 'Friend',
        avatarUrl: null,
        readAt: new Date().toISOString(),
      },
    ],
    totalMembers: 3,
  };

  beforeEach(async () => {
    chatService = { getMessageReceipts: vi.fn().mockResolvedValue(receiptStatus) };

    await TestBed.configureTestingModule({
      imports: [ReadReceiptComponent],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: I18nService, useValue: { translate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadReceiptComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('messageId', 'message-1');
    translate.mockClear();
  });

  it('renders a single tick for a sent message', () => {
    fixture.componentRef.setInput('deliveryStatus', 'sent');
    fixture.detectChanges();

    expect(component.displayStatus()).toBe('sent');
    expect(fixture.nativeElement.querySelectorAll('svg')).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelector('button').getAttribute('aria-label'),
    ).toContain('readReceipts.sent');
  });

  it('renders a double tick for a delivered message', () => {
    fixture.componentRef.setInput('deliveryStatus', 'delivered');
    fixture.detectChanges();

    expect(component.displayStatus()).toBe('delivered');
    expect(fixture.nativeElement.querySelectorAll('svg')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('path')).toHaveLength(2);
  });

  it('renders the read state with the secondary ink colour', () => {
    fixture.componentRef.setInput('deliveryStatus', 'read');
    fixture.detectChanges();

    expect(component.displayStatus()).toBe('read');
    expect(
      fixture.nativeElement.querySelector('svg').getAttribute('class'),
    ).toContain('text-secondary-ink');
  });

  it('gives the receipt trigger the shared 44 CSS pixel touch target', () => {
    fixture.componentRef.setInput('deliveryStatus', 'read');
    fixture.detectChanges();

    const trigger: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');
    expect(trigger.classList).toContain('size-11');
  });

  it('uses a native button so keyboard activation toggles the detail panel', () => {
    fixture.componentRef.setInput('deliveryStatus', 'read');
    fixture.detectChanges();

    const trigger: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');
    expect(trigger.type).toBe('button');
    expect(trigger.getAttribute('tabindex')).toBeNull();

    trigger.click();
    fixture.detectChanges();

    expect(component.showDetail()).toBe(true);

    trigger.click();
    fixture.detectChanges();

    expect(component.showDetail()).toBe(false);
  });

  it('loads and renders read-by details when the panel opens', async () => {
    fixture.componentRef.setInput('deliveryStatus', 'read');
    fixture.componentRef.setInput('isGroup', true);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button');
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(chatService.getMessageReceipts).toHaveBeenCalledWith('message-1');
    expect(fixture.nativeElement.textContent).toContain('Partner');
    expect(fixture.nativeElement.textContent).toContain('Friend');
    expect(fixture.nativeElement.textContent).toContain('readReceipts.readByCount');
  });

  it('keeps the status usable when the receipt request fails', async () => {
    chatService.getMessageReceipts.mockRejectedValueOnce(new Error('offline'));
    fixture.componentRef.setInput('deliveryStatus', 'read');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button');
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.receiptData()).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeTruthy();
  });

  it('formats recent read times using translated relative labels', () => {
    expect(component.formatTimeAgo(new Date().toISOString())).toBe('[time.justNow]');
  });
});
