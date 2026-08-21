import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ShopComponent } from './shop.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { JoyrideModule } from 'ngx-joyride';

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

class MockAuthService {
  getAccessToken = () => 'test-token';
  currentUser = signal({ id: 'user-1', email: 'test@test.com' });
}

describe('ShopComponent', () => {
  let component: ShopComponent;
  let fixture: ComponentFixture<ShopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopComponent, TranslatePipe, RouterModule.forRoot([]), JoyrideModule.forRoot()],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: AuthService, useClass: MockAuthService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShopComponent);
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

  it('should display shop title', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('shop.title');
  });

  it('should display shop subtitle', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('shop.subtitle');
  });
});
