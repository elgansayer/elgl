import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { ChatSettingsComponent } from './chat-settings.component';
import { ChatSettingsService } from '../../services/chat-settings.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('ChatSettingsComponent', () => {
  let component: ChatSettingsComponent;
  let fixture: ComponentFixture<ChatSettingsComponent>;
  let mockService: {
    autoTranslate: ReturnType<typeof signal<boolean>>;
    readReceipts: ReturnType<typeof signal<boolean>>;
    enterToSend: ReturnType<typeof signal<boolean>>;
    loaded: ReturnType<typeof signal<boolean>>;
    loadFailed: ReturnType<typeof signal<boolean>>;
    saving: ReturnType<typeof signal<boolean>>;
    loadSettings: ReturnType<typeof vi.fn>;
    updateSetting: ReturnType<typeof vi.fn>;
    resetToDefaults: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      autoTranslate: signal(false),
      readReceipts: signal(false),
      enterToSend: signal(false),
      loaded: signal(false),
      loadFailed: signal(false),
      saving: signal(false),
      loadSettings: vi.fn().mockResolvedValue(true),
      updateSetting: vi.fn().mockResolvedValue(true),
      resetToDefaults: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [ChatSettingsComponent],
      providers: [{ provide: ChatSettingsService, useValue: mockService }],
    })
      .overrideComponent(ChatSettingsComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatSettingsComponent);
    component = fixture.componentInstance;
  });

  it('loads account settings on construction', () => {
    expect(component).toBeTruthy();
    expect(mockService.loadSettings).toHaveBeenCalledTimes(1);
  });

  it('announces loading before authoritative account state is available', () => {
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status?.textContent).toContain('common.loading');
    expect(fixture.nativeElement.querySelectorAll('[role="switch"]')).toHaveLength(0);
  });

  it('renders a retryable alert instead of editable defaults when loading fails', async () => {
    mockService.loaded.set(true);
    mockService.loadFailed.set(true);
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    const retry = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('common.retry'),
    ) as HTMLButtonElement | undefined;

    expect(alert?.textContent).toContain('common.error');
    expect(retry).toBeTruthy();

    retry?.click();
    await fixture.whenStable();
    expect(mockService.loadSettings).toHaveBeenCalledTimes(2);
  });

  it('renders all three accessible switches with touch-sized controls', () => {
    mockService.loaded.set(true);
    fixture.detectChanges();

    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches).toHaveLength(3);
    expect(switches[0].getAttribute('aria-label')).toBe('chat_settings.auto_translate');
    expect(switches[1].getAttribute('aria-label')).toBe('chat_settings.read_receipts');
    expect(switches[2].getAttribute('aria-label')).toBe('chat_settings.enter_to_send');
    expect(switches[0].classList.contains('h-11')).toBe(true);
  });

  it('reflects confirmed switch state through aria-checked', () => {
    mockService.loaded.set(true);
    mockService.autoTranslate.set(true);
    fixture.detectChanges();

    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    expect(switches[1].getAttribute('aria-checked')).toBe('false');
  });

  it('persists Auto-Translate changes before treating them as successful', async () => {
    mockService.loaded.set(true);
    fixture.detectChanges();

    const switchElement = fixture.nativeElement.querySelectorAll('[role="switch"]')[0];
    switchElement.click();
    await fixture.whenStable();

    expect(mockService.updateSetting).toHaveBeenCalledWith('autoTranslate', true);
    expect(component.saveFailed()).toBe(false);
  });

  it('persists Read Receipts and Enter-to-Send independently', async () => {
    mockService.loaded.set(true);
    mockService.readReceipts.set(true);
    fixture.detectChanges();

    const switches = fixture.nativeElement.querySelectorAll('[role="switch"]');
    switches[1].click();
    await fixture.whenStable();
    switches[2].click();
    await fixture.whenStable();

    expect(mockService.updateSetting).toHaveBeenCalledWith('readReceipts', false);
    expect(mockService.updateSetting).toHaveBeenCalledWith('enterToSend', true);
  });

  it('disables every mutation control while a setting is being saved', () => {
    mockService.loaded.set(true);
    mockService.saving.set(true);
    fixture.detectChanges();

    const switches = Array.from(
      fixture.nativeElement.querySelectorAll('[role="switch"]'),
    ) as HTMLButtonElement[];
    const reset = fixture.nativeElement.querySelector(
      '[data-testid="reset-chat-settings"]',
    ) as HTMLButtonElement;

    expect(switches.every((control) => control.disabled)).toBe(true);
    expect(reset.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('common.saving');
  });

  it('surfaces a retryable save failure without fabricating success', async () => {
    mockService.loaded.set(true);
    mockService.updateSetting.mockResolvedValueOnce(false);
    fixture.detectChanges();

    fixture.nativeElement.querySelectorAll('[role="switch"]')[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.saveFailed()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'common.error',
    );
  });

  it('persists Reset to defaults through the service', async () => {
    mockService.loaded.set(true);
    fixture.detectChanges();

    const reset = fixture.nativeElement.querySelector(
      '[data-testid="reset-chat-settings"]',
    ) as HTMLButtonElement;
    reset.click();
    await fixture.whenStable();

    expect(mockService.resetToDefaults).toHaveBeenCalledTimes(1);
    expect(component.saveFailed()).toBe(false);
  });

  it('reports a failed Reset to defaults mutation', async () => {
    mockService.loaded.set(true);
    mockService.resetToDefaults.mockResolvedValueOnce(false);
    fixture.detectChanges();

    const reset = fixture.nativeElement.querySelector(
      '[data-testid="reset-chat-settings"]',
    ) as HTMLButtonElement;
    reset.click();
    await fixture.whenStable();

    expect(component.saveFailed()).toBe(true);
  });
});
