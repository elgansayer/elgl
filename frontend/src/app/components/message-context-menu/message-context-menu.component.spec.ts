import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { vi } from 'vitest';
import { MessageContextMenuComponent } from './message-context-menu.component';
import { ChatMessage } from '../../services/chat.service';

const mockMessage: ChatMessage = {
  id: 'msg-1',
  room_id: 'room-1',
  sender_id: 'user-1',
  message_type: 'text',
  text_content: 'Hello world',
} as ChatMessage;

@Component({
  template: `
    <app-message-context-menu
      [message]="message()"
      [x]="x()"
      [y]="y()"
      (copyMessage)="onCopy($event)"
      (favourite)="onFavourite($event)"
      (report)="onReport($event)"
      (closed)="onClosed()"
    />
  `,
  imports: [MessageContextMenuComponent],
})
class TestHostComponent {
  message = signal<ChatMessage>(mockMessage);
  x = signal(15);
  y = signal(25);
  copied: ChatMessage | null = null;
  favourited: ChatMessage | null = null;
  reported: ChatMessage | null = null;
  closeCount = 0;

  onCopy(msg: ChatMessage): void {
    this.copied = msg;
  }

  onFavourite(msg: ChatMessage): void {
    this.favourited = msg;
  }

  onReport(msg: ChatMessage): void {
    this.reported = msg;
  }

  onClosed(): void {
    this.closeCount++;
  }
}

describe('MessageContextMenuComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, MessageContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  function menuItems(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]'));
  }

  it('should render three menu items via the shared context-menu primitive', () => {
    const items = menuItems();
    expect(items.length).toBe(3);
  });

  it('should render the danger token on the report action, not a hardcoded red', () => {
    const items = menuItems();
    const reportItem = items.find((el) => el.classList.contains('text-danger'));
    expect(reportItem).toBeTruthy();
    expect(fixture.nativeElement.innerHTML).not.toMatch(/text-red-\d/);
  });

  it('should copy the message text and emit copyMessage when Copy is clicked', () => {
    menuItems()[0].click();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello world');
    expect(host.copied).toEqual(mockMessage);
  });

  it('should emit favourite when Favourite is clicked', () => {
    menuItems()[1].click();
    expect(host.favourited).toEqual(mockMessage);
  });

  it('should emit report when Report is clicked', () => {
    menuItems()[2].click();
    expect(host.reported).toEqual(mockMessage);
  });

  it('should emit closed when the underlying context menu is dismissed', () => {
    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closeCount).toBe(1);
  });

  it('should not hardcode English menu labels', () => {
    const html = fixture.nativeElement.innerHTML as string;
    expect(html).toContain('Copy');
    expect(html).toContain('Favourite');
    expect(html).toContain('Report');
  });
});
