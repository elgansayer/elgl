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

  it('should have approved output emitter', () => {
    const instance = fixture.componentInstance;
    const emitted: string[] = [];
    instance.approved.subscribe((id: string) => emitted.push(id));
    instance.approved.emit('test-user-123');
    expect(emitted).toEqual(['test-user-123']);
  });

  it('should have declined output emitter', () => {
    const instance = fixture.componentInstance;
    const emitted: string[] = [];
    instance.declined.subscribe((id: string) => emitted.push(id));
    instance.declined.emit('test-user-456');
    expect(emitted).toEqual(['test-user-456']);
  });

  it('should have closed output emitter', () => {
    const instance = fixture.componentInstance;
    let closedCount = 0;
    instance.closed.subscribe(() => closedCount++);
    instance.closed.emit();
    expect(closedCount).toBe(1);
  });
});
