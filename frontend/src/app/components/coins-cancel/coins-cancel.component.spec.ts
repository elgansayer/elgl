import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinsCancelComponent, TranslatePipe],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        provideRouter([]),
      ],
    }).compileComponents();

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

  it('should use a native Spartan navigation link for the back action', () => {
    const backLink: HTMLAnchorElement = fixture.nativeElement.querySelector('a');

    expect(backLink).toBeTruthy();
    expect(backLink.getAttribute('href')).toBe('/dashboard');
    expect(backLink.getAttribute('size')).toBe('touch');
    expect(backLink.hasAttribute('role')).toBe(false);
    expect(backLink.hasAttribute('tabindex')).toBe(false);
    backLink.focus();
    expect(document.activeElement).toBe(backLink);
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

  it('should display back action', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('coinsCancel.backBtn');
  });
});
