import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { WordDefinitionModalComponent } from './word-definition-modal.component';
import { By } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Component, signal, ErrorHandler } from '@angular/core';
import { VocabularyStore } from '../../services/vocabulary.store';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { I18nService } from '../../services/i18n.service';

@Component({ template: '' })
class DummyComponent {}

describe('WordDefinitionModalComponent Navigation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        WordDefinitionModalComponent,
        RouterTestingModule.withRoutes([{ path: 'review', component: DummyComponent }])
      ],
      providers: [
        {
          provide: VocabularyStore,
          useValue: {
            getWordStatus: vi.fn().mockReturnValue({ level: 0, colorClass: '', colourClass: '' }),
            translateWordOrSentence: vi.fn().mockResolvedValue({
                original_text: 'hola', translated_text: 'hello', detected_language: 'es'
            }),
          },
        },
        {
          provide: HtmlSanitisationService,
          useValue: { sanitiseText: (v: string) => v, sanitiseUrl: (v: string) => v },
        },
        {
          provide: I18nService,
          useValue: { currentLang: signal('en-GB'), translate: (k: string) => k },
        },
        { provide: ErrorHandler, useValue: { handleError: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('contains a link to the /review route', async () => {
    const fixture = TestBed.createComponent(WordDefinitionModalComponent);
    fixture.componentRef.setInput('wordToken', 'hola');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // We mock a scenario where existingCard is available to see the SRS UI block
    fixture.componentInstance.existingCard.set({
      id: '1', user_id: '1', word_token: 'hola', translation: 'hello', srs_level: 0,
      easiness_factor: 2.5, repetitions: 0, interval_days: 0, next_review_at: '', created_at: ''
    });
    fixture.detectChanges();

    const linkDe = fixture.debugElement.query(By.directive(RouterLink));
    expect(linkDe).toBeTruthy();

    const routerLink = linkDe.injector.get(RouterLink);
    // Angular routerLink returns an array representation internally for bound inputs
    expect(routerLink.urlTree?.toString()).toBe('/review');
  });
});
