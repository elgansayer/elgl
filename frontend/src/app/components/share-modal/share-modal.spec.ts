import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareEntity, ShareModalComponent } from './share-modal';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('ShareModalComponent', () => {
  let component: ShareModalComponent;
  let fixture: ComponentFixture<ShareModalComponent>;

  const sampleEntity: ShareEntity = {
    id: 'entity-1',
    type: 'event',
    title: 'Tokyo Language Café',
    subtitle: 'Event · Sat 14:00',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    externalLink: 'https://hellotalk.app/events/7f2c',
  };

  beforeEach(async () => {
    const i18nMock = {
      direction: signal<'ltr' | 'rtl'>('ltr'),
      translate: vi.fn((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [ShareModalComponent],
      providers: [{ provide: I18nService, useValue: i18nMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entity', sampleEntity);
    fixture.componentRef.setInput('isOpen', false);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reflect dialog closed state when isOpen is false', () => {
    expect(component.dialogState()).toBe('closed');
  });

  it('should reflect dialog open state when isOpen is true', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    expect(component.dialogState()).toBe('open');
  });

  it('renders Spartan Helm dialog title and accessible structure when open', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const title = document.querySelector('[hlmDialogTitle], [data-slot="dialog-title"]');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('share.title');

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-labelledby')).toBe(title?.id);

    const copyInput = document.querySelector('hlm-dialog-content input') as HTMLInputElement | null;
    expect(copyInput).not.toBeNull();
    expect(copyInput?.value).toContain('https://hellotalk.app/events/7f2c?ref=user_token_123');
  });

  it('emits closed output when the close button is clicked', async () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const closeBtn = document.querySelector('button[aria-label="common.close"]') as HTMLButtonElement | null;
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();

    expect(closedSpy).toHaveBeenCalled();
  });

  it('emits closed when dialog state transitions to closed while open', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    component.onDialogStateChanged('closed');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('shares to direct message and closes', () => {
    const sharedToChatSpy = vi.fn();
    const closedSpy = vi.fn();
    component.sharedToChat.subscribe(sharedToChatSpy);
    component.closed.subscribe(closedSpy);

    component.shareToDirectMessage();

    expect(sharedToChatSpy).toHaveBeenCalledWith('dm');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('shares to feed and closes', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component.shareToFeed();

    expect(closedSpy).toHaveBeenCalled();
  });

  it('copies link to clipboard and updates copying state', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    await component.copyLink();

    expect(writeTextMock).toHaveBeenCalledWith('https://hellotalk.app/events/7f2c?ref=user_token_123');
    expect(component.isCopying()).toBe(true);
  });
});
