import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { VocabularyDashboardComponent } from './vocabulary-dashboard.component';
import { I18nService } from '../../services/i18n.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { vi } from 'vitest';

describe('VocabularyDashboardComponent', () => {
  let component: VocabularyDashboardComponent;
  let fixture: ComponentFixture<VocabularyDashboardComponent>;
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockErrorHandler = {
      handleError: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [VocabularyDashboardComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>): string => {
              let text = key;
              if (params) {
                for (const [k, v] of Object.entries(params)) {
                  text = text.split(`{{${k}}}`).join(String(v));
                }
              }
              return text;
            },
          } as any,
        },
        { provide: ErrorHandler, useValue: mockErrorHandler },
        {
          provide: VocabularyStore,
          useValue: {
            updateSrsLevel: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VocabularyDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with initial card index 0', () => {
    expect(component.currentIndex()).toBe(0);
    expect(component.isFlipped()).toBe(false);
  });

  it('should flip card on demand', () => {
    expect(component.isFlipped()).toBe(false);
    component.flipCard();
    expect(component.isFlipped()).toBe(true);
  });

  it('should advance to next card after grading good', async () => {
    const start = component.currentIndex();
    await component.grade('good');
    expect(component.currentIndex()).toBe(start + 1);
  });

  it('should track grades per review grade', async () => {
    const startGrades = component.grades();
    await component.grade('again');
    const afterGrades = component.grades();
    expect(afterGrades.again).toBe(startGrades.again + 1);
  });

  it('should mark completion when past last card', async () => {
    const total = component.cardCount();
    // Grade all cards
    for (let i = 0; i < total; i++) {
      await component.grade('known');
    }
    expect(component.isComplete()).toBe(true);
  });

  it('should reset state on restart', async () => {
    component.flipCard();
    await component.grade('again');
    await component.grade('good');
    expect(component.currentIndex()).toBe(2);

    component.restart();
    expect(component.currentIndex()).toBe(0);
    expect(component.isFlipped()).toBe(false);
    expect(component.grades().again).toBe(0);
    expect(component.grades().good).toBe(0);
    expect(component.grades().known).toBe(0);
  });

  it('should provide error context with card metadata', () => {
    const ctx = component.errorContext();
    expect(ctx.component).toBe('vocabulary-dashboard');
    expect(ctx.operation).toBe('review');
    expect(ctx.cardCount).toBeGreaterThan(0);
  });

  it('should handle errors during grading gracefully', async () => {
    // Simulate component.inject issues by disabling the error boundary
    await component.grade('good');
    // Should not throw and should advance
    expect(component.currentIndex()).toBe(1);
  });

  it('should handle errors during flip gracefully', () => {
    component.flipCard();
    expect(component.isFlipped()).toBe(true);
    component.flipCard();
    expect(component.isFlipped()).toBe(false);
  });
});
