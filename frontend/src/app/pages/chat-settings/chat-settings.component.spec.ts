import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { ChatSettingsComponent } from './chat-settings.component';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe.skip('ChatSettingsComponent', () => {
  let component: ChatSettingsComponent;
  let fixture: ComponentFixture<ChatSettingsComponent>;
  let mockService: {
    autoTranslate: ReturnType<typeof signal<boolean>>;
    readReceipts: ReturnType<typeof signal<boolean>>;
    enterToSend: ReturnType<typeof signal<boolean>>;
    loaded: ReturnType<typeof signal<boolean>>;
    loadSettings: ReturnType<typeof vi.fn>;
    updateSetting: ReturnType<typeof vi.fn>;
    resetToDefaults: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      autoTranslate: signal<boolean>(false),
      readReceipts: signal<boolean>(false),
      enterToSend: signal<boolean>(false),
      loaded: signal<boolean>(false),
      loadSettings: vi.fn(),
      updateSetting: vi.fn(),
      resetToDefaults: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ChatSettingsComponent],
      providers: [
        { provide: ChatSettingsService, useValue: mockService },
      ],
    })
      .overrideComponent(ChatSettingsComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatSettingsComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call loadSettings on construction', () => {
    expect(mockService.loadSettings).toHaveBeenCalledTimes(1);
  });

  it('should not call loadSettings more than once on detectChanges', () => {
    mockService.loadSettings.mockClear();
    fixture.detectChanges();
    expect(mockService.loadSettings).not.toHaveBeenCalled();
  });

  it('should display the title', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('h2');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('chat_settings.title');
  });

  it('should render all three toggle switches', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches.length).toBe(3);
  });

  it('should display unchecked state for auto-translate toggle', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
  });

  it('should display checked state for auto-translate toggle', () => {
    mockService.autoTranslate.set(true);
    mockService.loaded.set(true);
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
  });

  it('should toggle autoTranslate on click', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    switches[0].click();
    expect(mockService.updateSetting).toHaveBeenCalledWith('autoTranslate', true);
  });

  it('should toggle readReceipts on click when currently checked', () => {
    mockService.readReceipts.set(true);
    mockService.loaded.set(true);
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    switches[1].click();
    expect(mockService.updateSetting).toHaveBeenCalledWith('readReceipts', false);
  });

  it('should toggle enterToSend on click', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    switches[2].click();
    expect(mockService.updateSetting).toHaveBeenCalledWith('enterToSend', true);
  });

  it('should display translated labels for each setting', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('chat_settings.auto_translate');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.read_receipts');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.enter_to_send');
  });

  it('should display description subtitles', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('chat_settings.auto_translate_desc');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.read_receipts_desc');
    expect(fixture.nativeElement.textContent).toContain('chat_settings.enter_to_send_desc');
  });

  it('should render a reset to defaults button', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const resetBtn = fixture.nativeElement.querySelector('button.text-\\[\\#00bcd4\\]');
    expect(resetBtn).toBeTruthy();
    expect(resetBtn.textContent).toContain('chat_settings.reset_defaults');
  });

  it('should call resetToDefaults on service when reset button clicked', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();
    const resetBtn = fixture.nativeElement.querySelector('button.text-\\[\\#00bcd4\\]');
    resetBtn.click();
    expect(mockService.resetToDefaults).toHaveBeenCalledTimes(1);
  });
});
