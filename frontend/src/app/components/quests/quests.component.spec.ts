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
  quest_type: string;
  quest_key: string;
  target: number;
  progress: number;
  reward_coins: number;
  completed: boolean;
}

class MockQuestStore {
  quests = signal<Quest[]>([]);
  loading = signal(false);
  fetchQuests = vi.fn();
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
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('quests.loading');
  });

  it('should display empty state when no quests', () => {
    mockStore.loading.set(false);
    mockStore.quests.set([]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('quests.empty');
  });

  it('should display quests when available', () => {
    const mockQuests: Quest[] = [
      {
        id: 'q1',
        quest_type: 'daily',
        quest_key: 'send_messages',
        target: 10,
        progress: 5,
        reward_coins: 50,
        completed: false,
      },
    ];
    mockStore.quests.set(mockQuests);
    mockStore.loading.set(false);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('50');
    expect(text).toContain('5');
    expect(text).toContain('10');
  });
});