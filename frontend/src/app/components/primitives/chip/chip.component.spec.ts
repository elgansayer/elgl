import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppChipComponent } from './chip.component';

@Component({
  template: `
    <app-chip
      [label]="label()"
      [removable]="removable()"
      [selected]="selected()"
      [variant]="variant()"
      [customClass]="customClass()"
      (removed)="onRemoved()"
      (clicked)="onClicked()"
    >
      Projected Chip
    </app-chip>
  `,
  imports: [AppChipComponent],
})
class TestHostComponent {
  label = signal('Tag 1');
  removable = signal(true);
  selected = signal(false);
  variant = signal<'default' | 'outlined' | 'primary'>('default');
  customClass = signal('');
  removeCount = 0;
  clickCount = 0;

  onRemoved(): void {
    this.removeCount++;
  }

  onClicked(): void {
    this.clickCount++;
  }
}

describe('AppChipComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let chipElement: HTMLElement;
  let actionButton: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppChipComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    chipElement = fixture.nativeElement.querySelector('app-chip > span');
    actionButton = chipElement.querySelector('button:not([aria-label])') as HTMLButtonElement;
  });

  it('should create and render label when provided', () => {
    expect(chipElement).toBeTruthy();
    expect(chipElement.textContent?.trim()).toContain('Tag 1');
  });

  it('should render projected content when label is empty', () => {
    host.label.set('');
    fixture.detectChanges();
    expect(chipElement.textContent?.trim()).toContain('Projected Chip');
  });

  it('should apply product container styles and owned Helm compact sizing', () => {
    expect(chipElement.classList.contains('inline-flex')).toBe(true);
    expect(chipElement.classList.contains('bg-surface-100')).toBe(true);
    expect(actionButton.classList.contains('h-7')).toBe(true);
    expect(actionButton.classList.contains('px-2.5')).toBe(true);
  });

  it('should emit clicked event when the chip action is clicked', () => {
    actionButton.click();
    expect(host.clickCount).toBe(1);
  });

  it('should show remove button when removable and emit removed without emitting clicked', () => {
    const removeBtn = chipElement.querySelector('button[aria-label="Remove chip"]') as HTMLButtonElement | null;
    expect(removeBtn).toBeTruthy();
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove chip');

    removeBtn?.click();
    expect(host.removeCount).toBe(1);
    expect(host.clickCount).toBe(0);
  });

  it('should update classes when selected and variant change', () => {
    host.selected.set(true);
    host.variant.set('outlined');
    host.customClass.set('my-chip');
    fixture.detectChanges();

    expect(chipElement.classList.contains('border-2')).toBe(true);
    expect(chipElement.classList.contains('border-primary')).toBe(true);
    expect(chipElement.classList.contains('my-chip')).toBe(true);
  });
});
