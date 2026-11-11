import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineReadingService } from '../../services/offline-reading.service';
import { ReadingEngineApiService } from '../../services/reading-engine-api.service';
import { VocabularyStore } from '../../services/vocabulary.store';
import { ReadingEngineComponent } from './reading-engine.component';

/**
 * The reading engine tab strip is a horizontal tablist, so ArrowRight moves to the next tab in
 * LTR and to the previous tab in RTL (WAI-ARIA tabs pattern).
 */
describe('ReadingEngineComponent tab keyboard navigation', () => {
  const direction = signal<'ltr' | 'rtl'>('ltr');
  let component: ReadingEngineComponent;
  let fixture: ComponentFixture<ReadingEngineComponent>;

  function press(key: string, fromTab: 'articles' | 'vocabulary' | 'history'): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, cancelable: true });
    component.onTabKeydown(event, fromTab);
    return event;
  }

  beforeEach(async () => {
    direction.set('ltr');

    await TestBed.configureTestingModule({
      imports: [ReadingEngineComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { currentLang: signal('en-GB'), direction, translate: (key: string) => key },
        },
        { provide: VocabularyStore, useValue: { allFlashcards: signal([]) } },
        { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
        {
          provide: OfflineReadingService,
          useValue: {
            cacheArticles: async () => undefined,
            getCachedArticles: async () => [],
          },
        },
        { provide: ReadingEngineApiService, useValue: { getResources: async () => [] } },
      ],
    })
      .overrideComponent(ReadingEngineComponent, { set: { template: '<div></div>' } })
      .compileComponents();

    fixture = TestBed.createComponent(ReadingEngineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('moves forward with ArrowRight and backward with ArrowLeft in LTR', () => {
    expect(press('ArrowRight', 'articles').defaultPrevented).toBe(true);
    expect(component.activeTab()).toBe('vocabulary');

    press('ArrowRight', 'vocabulary');
    expect(component.activeTab()).toBe('history');

    press('ArrowLeft', 'history');
    expect(component.activeTab()).toBe('vocabulary');
  });

  it('wraps around the tab strip in LTR', () => {
    press('ArrowRight', 'history');
    expect(component.activeTab()).toBe('articles');

    press('ArrowLeft', 'articles');
    expect(component.activeTab()).toBe('history');
  });

  it('moves forward with ArrowLeft and backward with ArrowRight in RTL', () => {
    direction.set('rtl');

    expect(press('ArrowLeft', 'articles').defaultPrevented).toBe(true);
    expect(component.activeTab()).toBe('vocabulary');

    press('ArrowLeft', 'vocabulary');
    expect(component.activeTab()).toBe('history');

    press('ArrowRight', 'history');
    expect(component.activeTab()).toBe('vocabulary');
  });

  it('wraps around the tab strip in RTL', () => {
    direction.set('rtl');

    press('ArrowLeft', 'history');
    expect(component.activeTab()).toBe('articles');

    press('ArrowRight', 'articles');
    expect(component.activeTab()).toBe('history');
  });

  it.each(['ltr', 'rtl'] as const)('keeps Home and End independent of %s layout', (layout) => {
    direction.set(layout);

    press('End', 'articles');
    expect(component.activeTab()).toBe('history');

    press('Home', 'history');
    expect(component.activeTab()).toBe('articles');
  });

  it('leaves unrelated keys unhandled', () => {
    const event = press('ArrowDown', 'articles');

    expect(event.defaultPrevented).toBe(false);
    expect(component.activeTab()).toBe('articles');
  });
});
