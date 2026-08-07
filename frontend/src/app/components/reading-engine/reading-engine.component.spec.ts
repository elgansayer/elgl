import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ReadingEngineComponent } from './reading-engine.component';
import { VocabularyStore, Flashcard } from '../../services/vocabulary.store';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineReadingService } from '../../services/offline-reading.service';

class I18nStub {
  translate(key: string): string { return key; }
}

class NetworkStatusStub {
  isOnline = signal(true);
}

class OfflineReadingStub {
  isOfflineMode = signal(false);
  async cacheArticles(): Promise<void> {}
  async getCachedArticles(): Promise<unknown[]> { return []; }
  async recordReadingHistory(): Promise<void> {}
  async getReadingHistory(): Promise<unknown[]> { return []; }
  async clearAll(): Promise<void> {}
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
    fixture.detectChanges();
  });

  it('should create', () => { expect(component).toBeTruthy(); });
  it('should default to articles tab', () => { expect(component.activeTab()).toBe('articles'); });
  it('should have empty vocabulary count initially', () => { expect(component.vocabularyCount()).toBe(0); });
  it('should have null selected article by default', () => {
    expect(component.selectedArticleId()).toBeNull();
    expect(component.selectedArticle()).toBeNull();
  });
  it('should clear selection on backToList', () => {
    component.selectArticle('2');
    expect(component.selectedArticleId()).toBe('2');
    component.backToList();
    expect(component.selectedArticleId()).toBeNull();
  });
  it('should set and clear difficulty filter', () => {
    component.setFilter('beginner');
    expect(component.filterDifficulty()).toBe('beginner');
    component.setFilter(null);
    expect(component.filterDifficulty()).toBeNull();
  });
  it('should clear all filters', () => {
    component.setFilter('intermediate');
    component.setTopicFilter('culture');
    component.clearFilters();
    expect(component.filterDifficulty()).toBeNull();
    expect(component.filterTopic()).toBeNull();
  });
  it('should return empty filtered articles when no articles loaded', () => {
    expect(component.filteredArticles()).toEqual([]);
  });
  it('should return empty distinct topics when no articles loaded', () => {
    expect(component.distinctTopics()).toEqual([]);
  });
  it('should indicate offline status via isOffline signal', () => {
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
