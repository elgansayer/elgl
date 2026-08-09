import { ComponentFixture, TestBed } from '@angular/core/testing';
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
      providers: [{ provide: I18nService, useClass: MockI18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CoinsCancelComponent);
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