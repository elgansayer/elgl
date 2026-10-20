import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QuestsComponent } from './quests.component';
import { QuestStore } from '../../services/quests.store';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

class MockI18nService {
  translate(key: string, params?: Record<string, unknown>): string {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, String(v));
      }
      return result;
    }
    return key;
  }
}

interface Quest {
  id: string;
  quest_type: 'daily' | 'weekly';
  quest_key: 'correct_moments' | 'post_moment';
  target: number;
  progress: number;
  reward_coins: number;
  completed: boolean;
  period_start: string;
  reward_claimed_at: string | null;
}

class MockQuestStore {
  quests = signal<Quest[]>([]);
  loading = signal(false);
  error = signal(false);
  fetchQuests = vi.fn().mockResolvedValue(undefined);
}

describe('QuestsComponent', () => {
  let component: QuestsComponent;
  let fixture: ComponentFixture<QuestsComponent>;
  let mockStore: MockQuestStore;

  beforeEach(async () => {
    mockStore = new MockQuestStore();

    await TestBed.configureTestingModule({
      imports: [QuestsComponent, TranslatePipe],
      providers: [
        { provide: I18nService, useClass: MockI18nService },
        { provide: QuestStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should display loading state', () => {
    mockStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('quests.loading');
  });

  it('should display empty state when no quests', () => {
    mockStore.loading.set(false);
    mockStore.quests.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('quests.empty');
  });

  it('should display daily and weekly quest progress and reward', () => {
    mockStore.quests.set([
      {
        id: 'q1',
        quest_type: 'daily',
        quest_key: 'correct_moments',
        target: 3,
        progress: 2,
        reward_coins: 5,
        completed: false,
        period_start: '2026-08-22',
        reward_claimed_at: null,
      },
      {
        id: 'q2',
        quest_type: 'weekly',
        quest_key: 'correct_moments',
        target: 10,
        progress: 10,
        reward_coins: 20,
        completed: true,
        period_start: '2026-08-17',
        reward_claimed_at: '2026-08-22T10:00:00Z',
      },
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('quests.daily_correct_moments');
    expect(text).toContain('quests.weekly_correct_moments');
    expect(text).toContain('20');
  });

  it('shows a retryable error instead of misreporting a failed load as empty', () => {
    mockStore.error.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('common.error');
    expect(text).toContain('common.retry');
    expect(text).not.toContain('quests.empty');

    const retry = fixture.nativeElement.querySelector('button');
    retry.click();
    expect(mockStore.fetchQuests).toHaveBeenCalled();
  });

  it('clamps invalid progress values before rendering a percentage', () => {
    const quest = {
      id: 'q1',
      quest_type: 'daily' as const,
      quest_key: 'post_moment' as const,
      target: 1,
      progress: 99,
      reward_coins: 5,
      completed: true,
      period_start: '2026-08-22',
      reward_claimed_at: null,
    };

    expect(component.clampedProgress(quest)).toBe(1);
    expect(component.progressPercent(quest)).toBe(100);
    expect(component.progressPercent({ ...quest, target: 0 })).toBe(0);
  });
});
