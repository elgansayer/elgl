import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ReplyPreviewComponent } from './threaded-reply.component';
import { I18nService } from '../../services/i18n.service';
import { ChatMessage } from '../../services/chat.service';

describe('ReplyPreviewComponent', () => {
  let component: ReplyPreviewComponent;
  let fixture: ComponentFixture<ReplyPreviewComponent>;

  const parentMessage: ChatMessage = {
    id: 'm1',
    room_id: 'room-1',
    sender_id: 'user-2',
    message_type: 'text',
    text_content: 'Original message content',
    is_read: true,
    created_at: new Date().toISOString(),
    sender: { id: 'user-2', display_name: 'Emma', avatar_url: 'https://example.com/emma.png' },
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ReplyPreviewComponent],
      providers: [I18nService],
    }).compileComponents();

    fixture = TestBed.createComponent(ReplyPreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('parentMessage', parentMessage);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the parent sender name and text content', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Emma');
    expect(text).toContain('Original message content');
  });

  it('falls back to unknown user label when the parent has no sender', () => {
    fixture.componentRef.setInput('parentMessage', { ...parentMessage, sender: undefined });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Unknown user');
  });

  it('emits cancelReply when the cancel button is clicked', () => {
    vi.spyOn(component.cancelReply, 'emit');

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();

    expect(component.cancelReply.emit).toHaveBeenCalled();
  });
});
