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

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should display zero coins in body by default', () => {
    const bodyEl = fixture.debugElement.query(By.css('.text-text-secondary'));
    expect(bodyEl).not.toBeNull();
    expect(bodyEl.nativeElement.textContent).toContain('0 coins');
  });

  it('should display the title', () => {
    const titleEl = fixture.debugElement.query(By.css('h3'));
    expect(titleEl).not.toBeNull();
    expect(titleEl.nativeElement.textContent).toBeTruthy();
  });

  it('should display the CTA button', () => {
    const button = fixture.debugElement.query(By.css('button'));
    expect(button).not.toBeNull();
    expect(button.nativeElement.textContent).toBeTruthy();
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
