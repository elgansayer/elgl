import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatListComponent } from './chat-list.component';
import { ChatService } from '../../services/chat.service';
import * as toast from '../../services/toast.service';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

describe('ChatListComponent', () => {
  let component: ChatListComponent;
  let fixture: ComponentFixture<ChatListComponent>;
  let mockChatService: any;

  beforeEach(async () => {
    mockChatService = {
      getRecentChats: vi.fn().mockResolvedValue([]),
      getRooms: vi.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [ChatListComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChatListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('notImplemented should show toast', () => {
    component.notImplemented();
    expect(toast.toastsSignal().length).toBeGreaterThan(0);
  });
});
