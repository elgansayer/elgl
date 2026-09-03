import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FlashcardReviewComponent } from './flashcard-review.component';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Component, signal, ErrorHandler } from '@angular/core';
import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { HapticFeedbackService } from '../../services/haptic-feedback.service';

@Component({ template: '' })
class DummyComponent {}

describe('FlashcardReviewComponent Navigation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FlashcardReviewComponent,
        RouterTestingModule.withRoutes([{ path: 'ai-conversation', component: DummyComponent }])
      ],
      providers: [
        {
          provide: VocabularyStore,
          useValue: {
            loadAllFlashcards: vi.fn().mockResolvedValue(null),
            loadDueReviews: vi.fn().mockResolvedValue(null),
            isDegraded: signal(false),
            degradedReason: signal(''),
            pendingReviewCards: signal([{ id: '1', srs_level: 0 }]),
            updateSrsLevel: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: I18nService,
          useValue: { translate: (k: string) => k },
        },
        { provide: ErrorHandler, useValue: { handleError: vi.fn() } },
        { provide: HapticFeedbackService, useValue: { trigger: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('contains a link to /ai-conversation when complete', async () => {
    const fixture = TestBed.createComponent(FlashcardReviewComponent);
    fixture.detectChanges();

    // Simulate finishing the review session
    const component = fixture.componentInstance;
    await component.gradeReview('known');
    fixture.detectChanges();

    // It should now be complete and show the completion screen
    expect(component.isComplete()).toBe(true);

    const linkDe = fixture.debugElement.query(By.directive(RouterLink));
    expect(linkDe).toBeTruthy();

    const routerLink = linkDe.injector.get(RouterLink);
    expect(routerLink.urlTree?.toString()).toBe('/ai-conversation');
  });
});
