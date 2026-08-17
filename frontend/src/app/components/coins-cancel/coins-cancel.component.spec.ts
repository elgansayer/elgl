import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CoinsCancelComponent } from './coins-cancel.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

class MockI18nService {
  translate(key: string, params?: Record<string, unknown>): string {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return key;
  }
}

describe('CoinsCancelComponent', () => {
  let component: CoinsCancelComponent;
  let fixture: ComponentFixture<CoinsCancelComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinsCancelComponent, TranslatePipe],
      providers: [provideRouter([]), { provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CoinsCancelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose a named main landmark without an unnecessary live region', () => {
    const main = fixture.nativeElement.querySelector('main');
    const title = fixture.nativeElement.querySelector('#coins-cancel-title');
    const message = fixture.nativeElement.querySelector('#coins-cancel-message');

    expect(main).toBeTruthy();
    expect(main.getAttribute('aria-labelledby')).toBe('coins-cancel-title');
    expect(main.getAttribute('aria-describedby')).toBe('coins-cancel-message');
    expect(main.hasAttribute('aria-live')).toBe(false);
    expect(title.textContent).toContain('coinsCancel.title');
    expect(message.textContent).toContain('coinsCancel.message');
  });

  it('should keep decorative emoji out of the accessibility tree', () => {
    const decorativeEmoji = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(decorativeEmoji).toBeTruthy();
    expect(decorativeEmoji.textContent).toContain('😕');
  });

  it('should keep the back action keyboard focusable and touch-sized', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('size')).toBe('touch');
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('should navigate back to the dashboard when the back action is activated', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    button.click();

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should use fluid layout primitives that preserve reflow at high zoom', () => {
    const main = fixture.nativeElement.querySelector('main');
    const content = main.querySelector('div');

    expect(main.classList).toContain('px-4');
    expect(content.classList).toContain('w-full');
    expect(content.classList).toContain('max-w-md');
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bleft-\d/);
    expect(componentHtml).not.toMatch(/\bright-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should display cancel title', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('coinsCancel.title');
  });

  it('should display cancel message', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('coinsCancel.message');
  });

  it('should display back button', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('coinsCancel.backBtn');
  });
});
