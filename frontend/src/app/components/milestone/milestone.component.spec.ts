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

  it('marks a milestone as completed', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.complete('1');
    expect(serviceMock.markCompleted).toHaveBeenCalledWith('1');
  });

  it('removes a milestone', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.remove('1');
    expect(serviceMock.deleteMilestone).toHaveBeenCalledWith('1');
  });
});
