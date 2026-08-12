import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollablePillsComponent } from './scrollable-pills.component';

const pills = [
  { id: 'all', label: 'All users' },
  { id: 'serious', label: 'Serious learners' },
];

describe('ScrollablePillsComponent', () => {
  let fixture: ComponentFixture<ScrollablePillsComponent>;
  let component: ScrollablePillsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScrollablePillsComponent] });
    fixture = TestBed.createComponent(ScrollablePillsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pills', pills);
    fixture.componentRef.setInput('selected', 'all');
    fixture.componentRef.setInput('ariaLabel', 'Filter partners');
  });

  it('renders accessible radio buttons for every pill', async () => {
    await fixture.whenStable();

    const group = fixture.nativeElement.querySelector('[role="radiogroup"]');
    const buttons = fixture.nativeElement.querySelectorAll('button[role="radio"]');

    expect(group.getAttribute('aria-label')).toBe('Filter partners');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute('aria-label')).toBe('All users');
    expect(buttons[0].getAttribute('aria-checked')).toBe('true');
    expect(buttons[1].getAttribute('aria-checked')).toBe('false');
  });

  it('reacts to selected input changes and retains RTL-neutral spacing', async () => {
    fixture.componentRef.setInput('selected', 'serious');
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button[role="radio"]');
    const group = fixture.nativeElement.querySelector('[role="radiogroup"]');

    expect(buttons[0].classList.contains('bg-primary')).toBe(false);
    expect(buttons[1].classList.contains('bg-primary')).toBe(true);
    expect(group.classList.contains('px-4')).toBe(true);
  });

  it('emits the stable pill identity when a native button is clicked', async () => {
    const emit = vi.spyOn(component.pillPicked, 'emit');
    await fixture.whenStable();

    fixture.nativeElement.querySelectorAll('button')[1].click();
    await fixture.whenStable();

    expect(emit).toHaveBeenCalledExactlyOnceWith('serious');
  });
});
