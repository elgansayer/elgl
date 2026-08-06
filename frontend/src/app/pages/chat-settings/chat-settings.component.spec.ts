import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ChatSettingsComponent } from './chat-settings.component';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';

describe('ChatSettingsComponent', () => {
  let component: ChatSettingsComponent;
  let fixture: ComponentFixture<ChatSettingsComponent>;
  let mockSettingsService: any;
  let mockAuthService: any;

  beforeEach(async () => {
    mockSettingsService = {
      autoTranslate: signal(false),
      readReceipts: signal(false),
      enterToSend: signal(false),
      loaded: signal(true),
      loadSettings: vi.fn().mockResolvedValue(undefined),
      updateSetting: vi.fn(),
    };

    mockAuthService = {
        getBearerHeaders: vi.fn().mockReturnValue({}),
    }

    await TestBed.configureTestingModule({
      imports: [ChatSettingsComponent, TranslatePipe],
      providers: [
        { provide: ChatSettingsService, useValue: mockSettingsService },
        { provide: AuthService, useValue: mockAuthService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle autoTranslate', () => {
    component.toggleAutoTranslate();
    expect(mockSettingsService.updateSetting).toHaveBeenCalledWith('autoTranslate', true);
  });

  it('should toggle readReceipts', () => {
    component.toggleReadReceipts();
    expect(mockSettingsService.updateSetting).toHaveBeenCalledWith('readReceipts', true);
  });

  it('should toggle enterToSend', () => {
    component.toggleEnterToSend();
    expect(mockSettingsService.updateSetting).toHaveBeenCalledWith('enterToSend', true);
  });
});
