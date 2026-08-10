import { describe, it, expect } from 'vitest';
import { ApproveSpeakerModalComponent } from './approve-speaker-modal.component';

describe('ApproveSpeakerModalComponent', () => {
  it('should be creatable', () => {
    const instance = new ApproveSpeakerModalComponent();
    expect(instance).toBeTruthy();
  });

  it('should have raisedHands input with default empty array', () => {
    const instance = new ApproveSpeakerModalComponent();
    expect(instance.raisedHands()).toEqual([]);
  });

  it('should have approved output emitter', () => {
    const instance = new ApproveSpeakerModalComponent();
    const emitted: string[] = [];
    instance.approved.subscribe((id: string) => emitted.push(id));
    instance.approved.emit('test-user-123');
    expect(emitted).toEqual(['test-user-123']);
  });

  it('should have declined output emitter', () => {
    const instance = new ApproveSpeakerModalComponent();
    const emitted: string[] = [];
    instance.declined.subscribe((id: string) => emitted.push(id));
    instance.declined.emit('test-user-456');
    expect(emitted).toEqual(['test-user-456']);
  });

  it('should have closed output emitter', () => {
    const instance = new ApproveSpeakerModalComponent();
    let closedCount = 0;
    instance.closed.subscribe(() => closedCount++);
    instance.closed.emit();
    expect(closedCount).toBe(1);
  });
});
