import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler } from '@angular/core';
import { TokenisedTextComponent } from './tokenised-text.component';
import { VocabularyStore } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';

class I18nStub {
  translate(key: string): string {
    return key;
  }
}

describe('TokenisedTextComponent', () => {
  let component: TokenisedTextComponent;
  let fixture: ComponentFixture<TokenisedTextComponent>;
  let mockErrorHandler: { handleError: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockErrorHandler = { handleError: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TokenisedTextComponent],
      providers: [
        { provide: VocabularyStore, useValue: {} },
        { provide: I18nService, useClass: I18nStub },
        { provide: ErrorHandler, useValue: mockErrorHandler },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TokenisedTextComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('text', '');
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();
  });

  const setInputs = (text: string, language = 'en'): void => {
    fixture.componentRef.setInput('text', text);
    fixture.componentRef.setInput('language', language);
    fixture.detectChanges();
  };

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should split text into word and whitespace tokens using Intl.Segmenter', () => {
    setInputs('Hello world');
    const tokens = component.tokens();
    expect(tokens.length).toBeGreaterThan(0);

    const wordTokens = tokens.filter(t => t.isWordLike).map(t => t.segment);
    expect(wordTokens).toContain('Hello');
    expect(wordTokens).toContain('world');

    const spaceTokens = tokens.filter(t => !t.isWordLike).map(t => t.segment);
    expect(spaceTokens).toContain(' ');
  });

  it('should emit wordClicked when clicking a word token', () => {
    setInputs('Hello');
    const emitSpy = vi.spyOn(component.wordClicked, 'emit');

    const wordToken = component.tokens().find(t => t.isWordLike);
    expect(wordToken).toBeDefined();
    if (!wordToken) return;

    component.onTokenClick(wordToken);
    expect(emitSpy).toHaveBeenCalledWith({
      token: wordToken.segment,
      context: component.text(),
    });
  });

  it('should not emit when clicking a non-word token', () => {
    setInputs('Hello world');
    const emitSpy = vi.spyOn(component.wordClicked, 'emit');

    const nonWord = component.tokens().find(t => !t.isWordLike);
    expect(nonWord).toBeDefined();
    if (!nonWord) return;

    component.onTokenClick(nonWord);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should report error and return error state when Intl.Segmenter is unavailable', () => {
    const originalSegmenter = Intl.Segmenter;
    (Intl as Record<string, unknown>).Segmenter = undefined;

    try {
      setInputs('Test');
      expect(component.parseError()).toBeTruthy();
      expect(component.parseError()).toBe('errors.intlSegmenterUnavailable');
      expect(component.tokens()).toEqual([]);
      expect(mockErrorHandler.handleError).toHaveBeenCalledTimes(1);
      const reported = mockErrorHandler.handleError.mock.calls[0][0] as Error;
      expect(reported.name).toBe('LingqTokenisationError');
    } finally {
      (Intl as Record<string, unknown>).Segmenter = originalSegmenter;
    }
  });
});
