import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { ClassroomsMarketplace, ClassroomTutor } from './classrooms-marketplace';

function createTutor(overrides?: Partial<ClassroomTutor>): ClassroomTutor {
  return {
    id: 'tutor-1',
    name: 'Maria Garcia',
    avatarUrl: 'https://i.pravatar.cc/150?u=maria',
    thumbnailUrl: 'https://i.pravatar.cc/640?u=maria',
    rating: 4.7,
    reviewCount: 128,
    hourlyRateGbp: 15,
    hourlyRateUsd: 19,
    teachingLanguages: ['Spanish', 'Catalan'],
    headline: 'Native Spanish tutor with 5 years experience',
    ...overrides,
  };
}

describe('ClassroomsMarketplace', () => {
  let component: ClassroomsMarketplace;
  let fixture: ComponentFixture<ClassroomsMarketplace>;
  const mockI18nService = {
    translate: vi.fn((key: string) => key),
    currentLocale: signal('en'),
    direction: signal<'ltr' | 'rtl'>('ltr'),
  } as unknown as I18nService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassroomsMarketplace],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassroomsMarketplace);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no tutors are provided', () => {
    // Default tutors input is [], isLoading is false -> isEmpty is true
    expect(component.isEmpty()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('classrooms.emptyTitle');
  });

  it('should use RTL logical CSS classes and never physical-direction classes in the template', () => {
    // Verify the empty-state template (which is what renders by default) has no physical CSS
    const el = fixture.nativeElement as HTMLElement;
    const html = el.innerHTML;

    const physicalPatterns = [
      /\bpl-\d+/,
      /\bpr-\d+/,
      /\bml-\d+/,
      /\bmr-\d+/,
      /\bleft-\d+/,
      /\bright-\d+/,
      /\bborder-l\b/,
      /\bborder-r\b/,
      /\btext-left\b/,
      /\btext-right\b/,
    ];

    for (const pattern of physicalPatterns) {
      if (pattern.test(html)) {
        throw new Error(
          `Template contains physical-direction class matching ${pattern}. Use RTL logical properties instead (ps-, pe-, ms-, me-, start-, end-, border-s, border-e, text-start, text-end).`,
        );
      }
    }
  });
});
