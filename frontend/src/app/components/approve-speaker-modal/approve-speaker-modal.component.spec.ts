import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApproveSpeakerModalComponent } from './approve-speaker-modal.component';

describe('ApproveSpeakerModalComponent', () => {
  let fixture: ComponentFixture<ApproveSpeakerModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApproveSpeakerModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(ApproveSpeakerModalComponent);
    fixture.detectChanges();
  });

  it('should be creatable', () => {
    const instance = fixture.componentInstance;
    expect(instance).toBeTruthy();
  });

  it('should have raisedHands input with default empty array', () => {
    const instance = fixture.componentInstance;
    expect(instance.raisedHands()).toEqual([]);
  });

  it('should render dialog with accessibility attributes', () => {
    const dialogEl = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialogEl).toBeTruthy();
    expect(dialogEl.getAttribute('aria-modal')).toBe('true');
    expect(dialogEl.getAttribute('aria-labelledby')).toBe('approve-speaker-title');
  });

  it('should render empty state when no raised hands exist', () => {
    const emptyEl = fixture.nativeElement.querySelector('.text-text-secondary');
    expect(emptyEl).toBeTruthy();
  });

  it('should render speaker request rows when raised hands are provided', () => {
    fixture.componentRef.setInput('raisedHands', ['learner-abc-123', 'learner-def-456']);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(2);
  });

  it('should emit approved when approve button is clicked', () => {
    const instance = fixture.componentInstance;
    fixture.componentRef.setInput('raisedHands', ['learner-123']);
    fixture.detectChanges();

    const emitted: string[] = [];
    instance.approved.subscribe((id: string) => emitted.push(id));

    const approveBtn = fixture.nativeElement.querySelector('.bg-success') as HTMLButtonElement;
    expect(approveBtn).toBeTruthy();
    approveBtn.click();

    expect(emitted).toEqual(['learner-123']);
  });

  it('should emit declined when decline button is clicked', () => {
    const instance = fixture.componentInstance;
    fixture.componentRef.setInput('raisedHands', ['learner-456']);
    fixture.detectChanges();

    const emitted: string[] = [];
    instance.declined.subscribe((id: string) => emitted.push(id));

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const declineBtn = buttons.find(
      (btn) =>
        btn.textContent?.includes('Decline') ||
        btn.textContent?.includes('approveSpeaker.declineAction'),
    );
    expect(declineBtn).toBeTruthy();
    declineBtn?.click();

    expect(emitted).toEqual(['learner-456']);
  });

  it('should emit closed when close button or done button is clicked', () => {
    const instance = fixture.componentInstance;
    let closedCount = 0;
    instance.closed.subscribe(() => closedCount++);

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const closeBtn = buttons.find(
      (btn) =>
        btn.textContent?.includes('✕') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('close'),
    );
    expect(closeBtn).toBeTruthy();
    closeBtn?.click();
    expect(closedCount).toBe(1);

    const doneBtn = buttons.find(
      (btn) =>
        btn.textContent?.includes('Done') ||
        btn.textContent?.includes('approveSpeaker.doneBtn'),
    );
    expect(doneBtn).toBeTruthy();
    doneBtn?.click();
    expect(closedCount).toBe(2);
  });
});
