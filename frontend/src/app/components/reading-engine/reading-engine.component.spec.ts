import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ReadingEngineComponent } from './reading-engine.component';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';

class I18nStub {
  translate(key: string, params?: Record<string, unknown>): string {
    if (params) {
      return `${key} ${JSON.stringify(params)}`;
    }
    return key;
  }
}

describe('ReadingEngineComponent', () => {
  let component: ReadingEngineComponent;
  let fixture: ComponentFixture<ReadingEngineComponent>;

  beforeEach(async () => {
    const mockVocabStore: Partial<VocabularyStore> = {
      allFlashcards: signal<Flashcard[]>([]),
      flashcardMap: signal(new Map()),
      getWordStatus: () => ({
        level: 0,
        colorClass: 'bg-blue-500/20 text-blue-900',
        colourClass: 'bg-blue-500/20 text-blue-900',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ReadingEngineComponent, HttpClientTestingModule],
      providers: [
        { provide: VocabularyStore, useValue: mockVocabStore },
        { provide: I18nService, useClass: I18nStub },
      ],
    })
      .overrideComponent(ReadingEngineComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReadingEngineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to articles tab', () => {
    expect(component.activeTab()).toBe('articles');
  });

  it('should switch active tab via signal', () => {
    component.activeTab.set('vocabulary');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('vocabulary');

    component.activeTab.set('history');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('history');

    component.activeTab.set('articles');
    fixture.detectChanges();
    expect(component.activeTab()).toBe('articles');
  });

  it('should signal isLoading when resource is loading', () => {
    expect(component.isLoading()).toBeDefined();
  });

  it('should have empty vocabulary count initially', () => {
    expect(component.vocabularyCount()).toBe(0);
  });

  it('should have null selected article by default', () => {
    expect(component.selectedArticleId()).toBeNull();
    expect(component.selectedArticle()).toBeNull();
  });

  it('should set selected article ID on selectArticle call', () => {
    component.selectArticle('1');
    fixture.detectChanges();
    expect(component.selectedArticleId()).toBe('1');
  });

  it('should clear selection on backToList', () => {
    component.selectArticle('2');
    fixture.detectChanges();
    expect(component.selectedArticleId()).toBe('2');
    component.backToList();
    fixture.detectChanges();
    expect(component.selectedArticleId()).toBeNull();
  });

  it('should set and clear difficulty filter', () => {
    component.setFilter('beginner');
    fixture.detectChanges();
    expect(component.filterDifficulty()).toBe('beginner');

    component.setFilter(null);
    fixture.detectChanges();
    expect(component.filterDifficulty()).toBeNull();
  });

  it('should set and clear topic filter', () => {
    component.setTopicFilter('science');
    fixture.detectChanges();
    expect(component.filterTopic()).toBe('science');

    component.setTopicFilter(null);
    fixture.detectChanges();
    expect(component.filterTopic()).toBeNull();
  });

  it('should clear all filters', () => {
    component.setFilter('intermediate');
    component.setTopicFilter('culture');
    fixture.detectChanges();
    expect(component.filterDifficulty()).toBe('intermediate');
    expect(component.filterTopic()).toBe('culture');

    component.clearFilters();
    fixture.detectChanges();
    expect(component.filterDifficulty()).toBeNull();
    expect(component.filterTopic()).toBeNull();
  });

  it('should set errors to null on retry', () => {
    component.fetchError.set('Test error');
    fixture.detectChanges();
    expect(component.fetchError()).toBe('Test error');

    component.retryLoad();
    fixture.detectChanges();
    expect(component.fetchError()).toBeNull();
  });

  it('should return empty filtered articles when no articles loaded', () => {
    expect(component.filteredArticles()).toEqual([]);
  });

  it('should return empty distinct topics when no articles loaded', () => {
    expect(component.distinctTopics()).toEqual([]);
  });

  describe('keyboard navigation', () => {
    it('should have tabIds array with correct ids', () => {
      const tabIds = (component as unknown as { tabIds: readonly string[] }).tabIds;
      expect(tabIds).toEqual(['tab-articles', 'tab-vocabulary', 'tab-history']);
    });

    it('should call preventDefault on arrow key handlers', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.focusPreviousTab(event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('readonly properties', () => {
    it('should have isLoading signal that returns boolean', () => {
      const loading = component.isLoading();
      expect(typeof loading).toBe('boolean');
    });

    it('should have hasError signal that returns boolean', () => {
      const hasErr = component.hasError();
      expect(typeof hasErr).toBe('boolean');
    });

    it('should have hasNoArticles signal that returns boolean', () => {
      const hasNo = component.hasNoArticles();
      expect(typeof hasNo).toBe('boolean');
    });
  });
});