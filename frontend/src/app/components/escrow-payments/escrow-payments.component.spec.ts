import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EscrowPaymentsComponent } from './escrow-payments.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';

describe('EscrowPaymentsComponent', () => {
  let component: EscrowPaymentsComponent;
  let fixture: ComponentFixture<EscrowPaymentsComponent>;

  beforeEach(async () => {
    const mockI18nService = {
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params) {
          let result = key;
          for (const [k, v] of Object.entries(params)) {
            result = result.replace(`{${k}}`, String(v));
          }
          return result;
        }
        return key;
      }),
      currentLang: signal('en-GB'),
      availableLanguages: [],
      setLanguage: vi.fn(),
    };

    const mockAuthService = {
      getAccessToken: vi.fn(() => 'test-token'),
      currentUser: signal({ id: 'user-1', email: 'test@test.com' }),
    };

    const mockEscrowOnboardingService = {
      isCompleted: vi.fn(() => false),
      isTourInProgress: signal(false),
      markComplete: vi.fn(),
      stepNames: ['escrowStepTitle', 'escrowStepCreate', 'escrowStepFilters', 'escrowStepTransactions'],
    };

    await TestBed.configureTestingModule({
      imports: [EscrowPaymentsComponent, TranslatePipe],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: EscrowOnboardingService, useValue: mockEscrowOnboardingService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EscrowPaymentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should verify RTL logical CSS properties (ps-, pe-) are used instead of physical directions', () => {
    const componentHtml = fixture.nativeElement.innerHTML;

    // Physical direction classes must NOT appear
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);

    // Physical border classes must NOT appear
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);

    // Logical direction classes SHOULD appear
    expect(componentHtml).toMatch(/\bps-\d/);
    expect(componentHtml).toMatch(/\bpe-\d/);
    expect(componentHtml).toMatch(/\bms-\d/);
    expect(componentHtml).toMatch(/\bme-\d/);
  });
});