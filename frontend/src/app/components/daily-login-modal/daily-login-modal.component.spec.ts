import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DailyLoginModalComponent } from './daily-login-modal.component';

describe('DailyLoginModalComponent', () => {
  let component: DailyLoginModalComponent;
  let fixture: ComponentFixture<DailyLoginModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailyLoginModalComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DailyLoginModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display zero coins by default', () => {
    const coinEl = fixture.debugElement.query(By.css('.text-amber-500'));
    expect(coinEl).not.toBeNull();
    expect(coinEl.nativeElement.textContent).toBe('0 coins');
  });

  it('should display the coins value passed via input', () => {
    fixture.componentRef.setInput('coins', 42);
    fixture.detectChanges();
    const coinEl = fixture.debugElement.query(By.css('.text-amber-500'));
    expect(coinEl).not.toBeNull();
    expect(coinEl.nativeElement.textContent).toBe('42 coins');
  });

  it('should emit closed event when the button is clicked', () => {
    let emitted = false;
    const subscription = component.closed.subscribe(() => {
      emitted = true;
    });
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).not.toBeNull();
    button.triggerEventHandler('click', null);
    expect(emitted).toBe(true);
    subscription.unsubscribe();
  });
});
