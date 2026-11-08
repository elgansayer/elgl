import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ReadReceiptComponent } from './read-receipt.component';
import { ChatService } from '../../services/chat.service';
import { I18nService } from '../../services/i18n.service';

describe('ReadReceiptComponent', () => {
  let fixture: ComponentFixture<ReadReceiptComponent>;
  let getMessageReceipts: ReturnType<typeof vi.fn>;
  let translate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getMessageReceipts = vi.fn();
    translate = vi.fn((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ReadReceiptComponent],
      providers: [
        { provide: ChatService, useValue: { getMessageReceipts } },
        { provide: I18nService, useValue: { translate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReadReceiptComponent);
    fixture.componentRef.setInput('messageId', 'msg-1');
  });

  function render(status: 'sending' | 'sent' | 'delivered' | 'read'): HTMLElement {
    fixture.componentRef.setInput('deliveryStatus', status);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
  }

  it('shows a single check for a sent message', () => {
    const element = render('sent');

    expect(element).toBeTruthy();
    expect(element.getAttribute('aria-label')).toBe('readReceipts.sent');
    expect(element.querySelectorAll('path')).toHaveLength(1);
  });

  it('shows a double check for a delivered message', () => {
    const element = render('delivered');

    expect(element.getAttribute('aria-label')).toBe('readReceipts.delivered');
    expect(element.querySelectorAll('path')).toHaveLength(2);
  });

  it('uses the read tone for a read message without relying on colour alone', () => {
    const element = render('read');

    expect(element.getAttribute('aria-label')).toBe('readReceipts.read');
    expect(element.querySelectorAll('path')).toHaveLength(2);
    expect(element.querySelector('.text-secondary-ink')).toBeTruthy();
  });

  it('loads and lists the readers for a group message', async () => {
    const readBy = Array.from({ length: 6 }, (_, index) => ({
      userId: `user-${index}`,
      displayName: `Reader ${index}`,
      avatarUrl: null,
      readAt: '2026-11-08T10:00:00.000Z',
    }));
    getMessageReceipts.mockResolvedValue({
      messageId: 'msg-1',
      deliveryStatus: 'read',
      readBy,
      totalMembers: 8,
    });

    fixture.componentRef.setInput('isGroup', true);
    const element = render('read');
    element.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getMessageReceipts).toHaveBeenCalledWith('msg-1');
    const tooltip = fixture.nativeElement.querySelector('[role="tooltip"]');
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain('readReceipts.readByCount');
    expect(tooltip.textContent).toContain('+1');
    expect(element.getAttribute('aria-label')).toBe('readReceipts.readByCount');
  });

  it('toggles the reader detail from the keyboard', async () => {
    getMessageReceipts.mockResolvedValue({
      messageId: 'msg-1',
      deliveryStatus: 'read',
      readBy: [],
      totalMembers: 1,
    });

    const element = render('read');
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getMessageReceipts).toHaveBeenCalledWith('msg-1');
    expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeTruthy();
  });

  it('does not show group counts for a one-to-one chat', async () => {
    getMessageReceipts.mockResolvedValue({
      messageId: 'msg-1',
      deliveryStatus: 'read',
      readBy: [
        {
          userId: 'user-1',
          displayName: 'Amara',
          avatarUrl: null,
          readAt: '2026-11-08T10:00:00.000Z',
        },
      ],
      totalMembers: 1,
    });

    const element = render('read');
    element.dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tooltip = fixture.nativeElement.querySelector('[role="tooltip"]');
    expect(tooltip.textContent).not.toContain('readReceipts.readByCount');
  });
});
