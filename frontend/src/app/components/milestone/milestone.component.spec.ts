import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MilestoneComponent } from './milestone.component';
import { MilestoneService, Milestone, MilestoneProgress } from '../../services/milestone.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('MilestoneComponent', () => {
  let component: MilestoneComponent;
  let fixture: ComponentFixture<MilestoneComponent>;
  let serviceMock: {
    getMilestones: ReturnType<typeof vi.fn>;
    getProgress: ReturnType<typeof vi.fn>;
    createMilestone: ReturnType<typeof vi.fn>;
    markCompleted: ReturnType<typeof vi.fn>;
    deleteMilestone: ReturnType<typeof vi.fn>;
  };

  const mockMilestones: Milestone[] = [
    { id: '1', title: 'Complete 10 flashcards', completed: false },
  ];
  const mockProgress: MilestoneProgress = { total: 1, completed: 0, percentage: 0 };

  beforeEach(async () => {
    serviceMock = {
      getMilestones: vi.fn().mockResolvedValue(mockMilestones),
      getProgress: vi.fn().mockResolvedValue(mockProgress),
      createMilestone: vi.fn().mockResolvedValue({ id: '2', title: 'New goal', completed: false }),
      markCompleted: vi.fn().mockResolvedValue({ id: '1', title: 'Complete 10 flashcards', completed: true }),
      deleteMilestone: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [MilestoneComponent],
      providers: [{ provide: MilestoneService, useValue: serviceMock }],
    })
      .overrideComponent(MilestoneComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MilestoneComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads milestones and progress on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.getMilestones).toHaveBeenCalledTimes(1);
    expect(serviceMock.getProgress).toHaveBeenCalledTimes(1);
    expect(component.milestones()).toEqual(mockMilestones);
    expect(component.progress()).toEqual(mockProgress);
  });

  it('renders the milestone list', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Complete 10 flashcards');
  });

  it('does not submit when the title is blank', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.addMilestone(new Event('submit'));
    expect(serviceMock.createMilestone).not.toHaveBeenCalled();
  });

  it('creates a milestone and clears the form', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.newTitle.set('New goal');
    component.newDescription.set('Details');
    await component.addMilestone(new Event('submit'));

    expect(serviceMock.createMilestone).toHaveBeenCalledWith('New goal', 'Details');
    expect(component.newTitle()).toBe('');
    expect(component.newDescription()).toBe('');
  });

  it('prevents duplicate create submissions while a request is pending', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const request = deferred<Milestone>();
    serviceMock.createMilestone.mockReturnValue(request.promise);
    component.newTitle.set('New goal');

    const first = component.addMilestone(new Event('submit'));
    const duplicate = component.addMilestone(new Event('submit'));

    expect(serviceMock.createMilestone).toHaveBeenCalledTimes(1);
    expect(component.creating()).toBe(true);

    request.resolve({ id: '2', title: 'New goal', completed: false });
    await Promise.all([first, duplicate]);

    expect(component.creating()).toBe(false);
  });

  it('preserves the form and exposes a translated alert after create failure', async () => {
    const element = await renderLoadedState();
    serviceMock.createMilestone.mockRejectedValue(new Error('network unavailable'));
    component.newTitle.set('Keep this goal');
    component.newDescription.set('Retry details');

    await component.addMilestone(new Event('submit'));
    fixture.detectChanges();

    expect(component.newTitle()).toBe('Keep this goal');
    expect(component.newDescription()).toBe('Retry details');
    expect(component.creating()).toBe(false);
    expect(component.mutationError()).toBe(true);
    expect(element.querySelector<HTMLElement>('[role="alert"]')?.textContent).toContain('common.error');
  });

  it('marks a milestone as completed', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.complete('1');
    expect(serviceMock.markCompleted).toHaveBeenCalledWith('1');
  });

  it('prevents overlapping complete and remove mutations for the same milestone', async () => {
    const element = await renderLoadedState();
    const request = deferred<Milestone>();
    serviceMock.markCompleted.mockReturnValue(request.promise);

    const first = component.complete('1');
    const duplicate = component.complete('1');
    const overlappingRemove = component.remove('1');
    fixture.detectChanges();

    const completeButton = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('milestones.completeBtn'),
    );
    const removeButton = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('milestones.removeBtn'),
    );

    expect(serviceMock.markCompleted).toHaveBeenCalledTimes(1);
    expect(serviceMock.deleteMilestone).not.toHaveBeenCalled();
    expect(component.isMutating('1')).toBe(true);
    expect(completeButton?.disabled).toBe(true);
    expect(removeButton?.disabled).toBe(true);
    expect(completeButton?.getAttribute('aria-busy')).toBe('true');
    expect(removeButton?.getAttribute('aria-busy')).toBe('true');

    request.resolve({ id: '1', title: 'Complete 10 flashcards', completed: true });
    await Promise.all([first, duplicate, overlappingRemove]);

    expect(component.isMutating('1')).toBe(false);
  });

  it('clears row pending state and exposes an error after a failed mutation', async () => {
    await renderLoadedState();
    serviceMock.markCompleted.mockRejectedValue(new Error('network unavailable'));

    await component.complete('1');

    expect(component.isMutating('1')).toBe(false);
    expect(component.mutationError()).toBe(true);
  });

  it('removes a milestone', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.remove('1');
    expect(serviceMock.deleteMilestone).toHaveBeenCalledWith('1');
  });
});
