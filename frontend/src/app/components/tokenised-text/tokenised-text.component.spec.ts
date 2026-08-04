import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TokenisedTextComponent],
      providers: [
        { provide: VocabularyStore, useValue: {} },
        { provide: I18nService, useClass: I18nStub },
      ],
    })
      .overrideComponent(TokenisedTextComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

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
    (component as any).parseText();
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
    (component as any).parseText();
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
    (component as any).parseText();
    const emitSpy = vi.spyOn(component.wordClicked, 'emit');

    const nonWord = component.tokens().find(t => !t.isWordLike);
    expect(nonWord).toBeDefined();
    if (!nonWord) return;

    component.onTokenClick(nonWord);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should throw an error when Intl.Segmenter is unavailable', () => {
    const originalSegmenter = Intl.Segmenter;
    (Intl as any).Segmenter = undefined;

    try {
      expect(() => (component as any).parseText()).toThrow('errors.intlSegmenterUnavailable');
    } finally {
      (Intl as any).Segmenter = originalSegmenter;
    }
  });
});
