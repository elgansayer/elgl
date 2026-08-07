import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { DailyLoginModalComponent } from './daily-login-modal.component';

// Mock TranslatePipe for testing
@Component({
  selector: 'app-test-host',
  imports: [TranslatePipe, DailyLoginModalComponent],
  template: `
    <app-daily-login-modal [coins]="coinsValue()" (closed)="onClosed()" />
  `,
})
class TestHostComponent {
  coinsValue = input(0);
  closedSpy = output<void>();
  onClosed(): void {
    this.closedSpy.emit();
  }
}

describe('DailyLoginModalComponent', () => {
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
    hostFixture.detectChanges();
  });

  it('should create', () => {
    expect(hostComponent).toBeTruthy();
  });

  it('should render the modal dialog with correct structure', () => {
    const dialog = hostFixture.debugElement.query(By.css('[role="dialog"]'));
    expect(dialog).not.toBeNull();
    const title = dialog.query(By.css('#daily-login-modal-title'));
    expect(title).not.toBeNull();
  });

  it('should display the coins value passed via input', () => {
    hostFixture.componentRef.setInput('coinsValue', 42);
    hostFixture.detectChanges();
    const coinEl = hostFixture.debugElement.query(By.css('.text-amber-500'));
    expect(coinEl).not.toBeNull();
    expect(coinEl.nativeElement.textContent).toContain('42');
  });

  it('should render zero coins by default', () => {
    const coinEl = hostFixture.debugElement.query(By.css('.text-amber-500'));
    expect(coinEl).not.toBeNull();
    expect(coinEl.nativeElement.textContent).toContain('0');
  });

  it('should emit closed event when the button is clicked', () => {
    let emitted = false;
    hostFixture.detectChanges();
    const button = hostFixture.debugElement.query(By.css('button'));
    expect(button).not.toBeNull();
    const subscription = hostComponent.closedSpy.subscribe(() => {
      emitted = true;
    });
    button.triggerEventHandler('click', null);
    expect(emitted).toBe(true);
    subscription.unsubscribe();
  });
});
