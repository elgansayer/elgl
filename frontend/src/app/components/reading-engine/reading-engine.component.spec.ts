import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ReadingEngineComponent } from './reading-engine.component';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineReadingService } from '../../services/offline-reading.service';

class I18nStub {
  translate(key: string): string {
    return key;
  }
}

class NetworkStatusStub {
  isOnline = signal(true);
}

class OfflineReadingStub {
  isOfflineMode = signal(false);
  async cacheArticles(): Promise<void> {}
  async getCachedArticles(): Promise<unknown[]> {
    return [];
  }
  async recordReadingHistory(): Promise<void> {}
  async getReadingHistory(): Promise<unknown[]> {
    return [];
  }
  async clearAll(): Promise<void> {}
}

describe.skip('ReadingEngineComponent', () => {
  let component: ReadingEngineComponent;
  let fixture: ComponentFixture<ReadingEngineComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    const mockVocabStore: Partial<VocabularyStore> = {
      allFlashcards: signal<Flashcard[]>([]),
      flashcardMap: signal(new Map()),
      getWordStatus: () => ({
        level: 0,
        colorClass: 'bg-secondary/20 text-secondary',
        colourClass: 'bg-secondary/20 text-secondary',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ReadingEngineComponent, HttpClientTestingModule],
      providers: [
        { provide: VocabularyStore, useValue: mockVocabStore },
        { provide: I18nService, useClass: I18nStub },
        { provide: NetworkStatusService, useClass: NetworkStatusStub },
        { provide: OfflineReadingService, useClass: OfflineReadingStub },
      ],
    })
      .overrideComponent(ReadingEngineComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReadingEngineComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
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

  it('should return filtered articles when articles have loaded', async () => {
    await fixture.whenStable();
    expect(component.filteredArticles().length).toBeGreaterThan(0);
  });

  it('should return distinct topics when articles have loaded', async () => {
    await fixture.whenStable();
    expect(component.distinctTopics().length).toBeGreaterThan(0);
  });

  it('should indicate offline status via isOffline signal', async () => {
    await fixture.whenStable();
    expect(component.isOffline()).toBe(false);
  });

  it('should load reading history', async () => {
    await component.loadReadingHistory();
    expect(component.readingHistory()).toEqual([]);
  });

  it('should format read date without throwing', () => {
    const formatted = component.formatReadDate(Date.now());
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });
});
