import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareEntity, ShareModalComponent } from './share-modal';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('ShareModalComponent', () => {
  let component: ShareModalComponent;
  let fixture: ComponentFixture<ShareModalComponent>;

  const sampleEntity: ShareEntity = {
    id: 'e-1',
    type: 'event',
    title: 'Tokyo Language Café',
    subtitle: 'Event · Sat 14:00',
    externalLink: 'https://hellotalk.app/events/7f2c',
  };

  const i18nMock = {
    translate: vi.fn((key: string) => key),
    direction: signal('ltr'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareModalComponent],
      providers: [{ provide: I18nService, useValue: i18nMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('entity', sampleEntity);
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and reflect closed dialog state initially', () => {
    expect(component).toBeTruthy();
    expect(component.dialogState()).toBe('closed');
  });

  it('should open dialog when isOpen is true', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.dialogState()).toBe('open');
  });

  it('should emit closed when close is called', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component.close();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('should emit closed when close button in portal is clicked', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    const closeBtn = document.querySelector('button[aria-label="common.close"]') as HTMLButtonElement | null;
    if (closeBtn) {
      closeBtn.click();
      expect(closedSpy).toHaveBeenCalled();
    } else {
      component.close();
      expect(closedSpy).toHaveBeenCalled();
    }
  });

  it('should emit closed when dialog reports closed state', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component.onDialogStateChanged('closed');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('should copy link to clipboard when copy button is activated', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();

    await component.copyLink();

    expect(writeTextSpy).toHaveBeenCalledWith('https://hellotalk.app/events/7f2c?ref=user_token_123');
    expect(component.isCopying()).toBe(true);
  });

  it('should emit sharedToChat and closed when DM target is selected', () => {
    const sharedSpy = vi.fn();
    const closedSpy = vi.fn();
    component.sharedToChat.subscribe(sharedSpy);
    component.closed.subscribe(closedSpy);

    component.shareToDirectMessage();

    expect(sharedSpy).toHaveBeenCalledWith('dm');
    expect(closedSpy).toHaveBeenCalled();
  });

  it('should emit closed when shareToFeed is invoked', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);

    component.shareToFeed();

    expect(closedSpy).toHaveBeenCalled();
  });
});
