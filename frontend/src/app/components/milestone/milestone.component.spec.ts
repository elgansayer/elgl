import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    { id: '1', title: 'Complete 10 flashcards', description: 'Keep a steady pace', completed: false },
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

  async function renderLoadedState(): Promise<HTMLElement> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('loads milestones and progress on init', async () => {
    await renderLoadedState();

    expect(serviceMock.getMilestones).toHaveBeenCalledTimes(1);
    expect(serviceMock.getProgress).toHaveBeenCalledTimes(1);
    expect(component.milestones()).toEqual(mockMilestones);
    expect(component.progress()).toEqual(mockProgress);
  });

  it('renders the milestone list', async () => {
    const element = await renderLoadedState();

    expect(element.textContent).toContain('Complete 10 flashcards');
    expect(element.textContent).toContain('Keep a steady pace');
  });

  it('uses Relay card, radius and surface roles without generic rounded utilities', async () => {
    const element = await renderLoadedState();
    const progressbar = element.querySelector<HTMLElement>('[role="progressbar"]');
    const card = element.querySelector<HTMLElement>('article');
    const inputs = Array.from(element.querySelectorAll<HTMLElement>('input'));

    expect(progressbar?.classList.contains('rounded-pill')).toBe(true);
    expect(progressbar?.classList.contains('rounded-full')).toBe(false);
    expect(card?.classList.contains('rounded-card')).toBe(true);
    expect(card?.classList.contains('bg-surface-200')).toBe(true);
    expect(card?.classList.contains('shadow-card')).toBe(true);
    expect(inputs).toHaveLength(2);
    expect(inputs.every((input) => input.classList.contains('rounded-app'))).toBe(true);
    expect(element.innerHTML).not.toContain('rounded-lg');
    expect(element.innerHTML).not.toContain('rounded-md');
  });

  it('keeps primary actions touch-sized and responsive', async () => {
    const element = await renderLoadedState();
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button'));
    const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    const milestoneCard = element.querySelector<HTMLElement>('article > div');

    expect(buttons.length).toBeGreaterThanOrEqual(3);
    expect(buttons.every((button) => button.classList.contains('min-h-11'))).toBe(true);
    expect(submit?.classList.contains('w-full')).toBe(true);
    expect(submit?.classList.contains('sm:w-fit')).toBe(true);
    expect(milestoneCard?.classList.contains('flex-col')).toBe(true);
    expect(milestoneCard?.classList.contains('sm:flex-row')).toBe(true);
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