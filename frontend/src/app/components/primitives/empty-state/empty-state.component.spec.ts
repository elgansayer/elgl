import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppEmptyStateComponent } from './empty-state.component';

@Component({
  template: `
    <app-empty-state
      [icon]="icon()"
      [title]="title()"
      [description]="description()"
      [actionLabel]="actionLabel()"
      [customClass]="customClass()"
      (actionClicked)="onActionClicked()"
    >
      <p class="projected-note">Additional note</p>
    </app-empty-state>
  `,
  imports: [AppEmptyStateComponent],
})
class TestHostComponent {
  icon = signal('🔍');
  title = signal('No Results Found');
  description = signal('Try adjusting your search criteria.');
  actionLabel = signal('Clear Filters');
  customClass = signal('');
  actionCount = 0;

  onActionClicked(): void {
    this.actionCount++;
  }
}

describe('AppEmptyStateComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let emptyStateElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppEmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    emptyStateElement = fixture.nativeElement.querySelector('app-empty-state');
  });

  it('should create and render icon, title, description, and action button', () => {
    expect(emptyStateElement).toBeTruthy();
    expect(emptyStateElement.getAttribute('role')).toBe('region');
    expect(emptyStateElement.getAttribute('aria-label')).toBe('No Results Found');

    const heading = emptyStateElement.querySelector('h3');
    expect(heading?.textContent?.trim()).toBe('No Results Found');

    const desc = emptyStateElement.querySelector('p.text-text-secondary');
    expect(desc?.textContent?.trim()).toBe('Try adjusting your search criteria.');

    const btn = emptyStateElement.querySelector('button');
    expect(btn?.textContent?.trim()).toBe('Clear Filters');

    const note = emptyStateElement.querySelector('.projected-note');
    expect(note?.textContent?.trim()).toBe('Additional note');
  });

  it('should emit actionClicked when action button is clicked', () => {
    const btn = emptyStateElement.querySelector('button');
    btn?.click();
    expect(host.actionCount).toBe(1);
  });

  it('should hide button when actionLabel is empty and update aria-label fallback', () => {
    host.actionLabel.set('');
    host.title.set('');
    fixture.detectChanges();

    const btn = emptyStateElement.querySelector('button');
    expect(btn).toBeNull();
    expect(emptyStateElement.getAttribute('aria-label')).toBe('Empty state');
  });

  it('should apply customClass to container div', () => {
    host.customClass.set('custom-empty');
    fixture.detectChanges();

    const container = emptyStateElement.querySelector('div');
    expect(container?.classList.contains('custom-empty')).toBe(true);
  });
});
