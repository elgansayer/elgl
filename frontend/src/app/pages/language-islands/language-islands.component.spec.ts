import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageIslandsComponent } from './language-islands.component';
import {
  LanguageIsland,
  LanguageIslandsService,
} from '../../services/language-islands.service';
import { I18nService } from '../../services/i18n.service';

const TRANSLATIONS: Record<string, string> = {
  'languageIslands.title': 'Language Islands',
  'languageIslands.subtitle': 'Drop into an always-on space where only one language is spoken.',
  'languageIslands.filterAll': 'All islands',
  'languageIslands.filterLabel': 'Language filters',
  'languageIslands.practisingNow': '{{count}} practising now',
  'languageIslands.enter': 'Enter',
  'languageIslands.leave': 'Leave',
  'languageIslands.joinSuccess': 'Entered {{name}}',
  'languageIslands.loading': 'Loading language islands...',
  'languageIslands.error': 'Could not load language islands.',
  'languageIslands.retry': 'Retry',
  'languageIslands.empty': 'No language islands available right now.',
  'languageIslands.emptyDescription': 'New islands appear here as the community opens them.',
  'languageIslands.noMatches': 'No islands match this language yet.',
  'languageIslands.actionError': 'Could not update your island membership. Please try again.',
  'languageIslands.mapAriaLabel': 'Language islands map',
  'languageIslands.mapPinLabel': '{{name}}: {{count}} practising now',
};

function translate(key: string, params?: Record<string, unknown>): string {
  let text = TRANSLATIONS[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }
  return text;
}

describe('LanguageIslandsComponent', () => {
  let fixture: ComponentFixture<LanguageIslandsComponent>;
  let component: LanguageIslandsComponent;
  let listIslands: ReturnType<typeof vi.fn>;
  let getMyIslands: ReturnType<typeof vi.fn>;
  let joinIsland: ReturnType<typeof vi.fn>;
  let leaveIsland: ReturnType<typeof vi.fn>;

  const japaneseIsland: LanguageIsland = {
    id: 'island-ja',
    name: 'Japanese Island',
    description: 'Beginner-friendly',
    language_pair: 'ja-en',
    host_id: 'host-1',
    max_members: 500,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    member_count: 128,
  };

  const spanishIsland: LanguageIsland = {
    id: 'island-es',
    name: 'Spanish Island',
    description: null,
    language_pair: 'es-en',
    host_id: 'host-2',
    max_members: 500,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    member_count: 204,
  };

  beforeEach(async () => {
    listIslands = vi.fn().mockResolvedValue([japaneseIsland, spanishIsland]);
    getMyIslands = vi.fn().mockResolvedValue([]);
    joinIsland = vi.fn().mockResolvedValue(undefined);
    leaveIsland = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [LanguageIslandsComponent],
      providers: [
        {
          provide: LanguageIslandsService,
          useValue: { listIslands, getMyIslands, joinIsland, leaveIsland },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: () => 'en-GB',
            translate,
            availableLanguages: [
              { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', isRtl: false },
              { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', isRtl: false },
            ],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageIslandsComponent);
    component = fixture.componentInstance;
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('loads and renders the available islands', async () => {
    await render();

    expect(listIslands).toHaveBeenCalledWith({ limit: 50 });
    expect(text()).toContain('Japanese Island');
    expect(text()).toContain('Spanish Island');
    expect(text()).toContain('128 practising now');
    expect(text()).toContain('204 practising now');

    const pins = (fixture.nativeElement as HTMLElement).querySelectorAll('.map-pin');
    expect(pins).toHaveLength(2);
    expect(pins[0]?.getAttribute('aria-label')).toBe(
      'Japanese Island: 128 practising now',
    );
  });

  it('filters the list by the selected language', async () => {
    await render();

    component.selectLanguage('ja');
    fixture.detectChanges();

    expect(component.filteredIslands()).toEqual([japaneseIsland]);
    expect(text()).not.toContain('Spanish Island');
  });

  it('restores membership state for every joined island', async () => {
    getMyIslands.mockResolvedValue([japaneseIsland, spanishIsland]);

    await render();

    expect(getMyIslands).toHaveBeenCalled();
    expect(component.isJoined('island-ja')).toBe(true);
    expect(component.isJoined('island-es')).toBe(true);
    expect(text()).toContain('Leave');
  });

  it('joins an island and updates the local membership state', async () => {
    await render();

    await component.toggleMembership(japaneseIsland);
    fixture.detectChanges();

    expect(joinIsland).toHaveBeenCalledWith('island-ja');
    expect(component.isJoined('island-ja')).toBe(true);
    expect(component.statusMessage()).toBe('Japanese Island');
    expect(text()).toContain('Entered Japanese Island');
    expect(text()).toContain('Leave');
  });

  it('leaves an island and clears the joined state', async () => {
    getMyIslands.mockResolvedValue([japaneseIsland]);
    await render();

    await component.toggleMembership(japaneseIsland);
    fixture.detectChanges();

    expect(leaveIsland).toHaveBeenCalledWith('island-ja');
    expect(component.isJoined('island-ja')).toBe(false);
    expect(component.statusMessage()).toBeNull();
  });

  it('reports a failed membership update without changing local state', async () => {
    joinIsland.mockRejectedValue(new Error('nope'));
    await render();

    await component.toggleMembership(japaneseIsland);
    fixture.detectChanges();

    expect(component.actionFailed()).toBe(true);
    expect(component.isJoined('island-ja')).toBe(false);
    expect(text()).toContain('Could not update your island membership. Please try again.');
  });

  it('shows an empty state when no islands are available', async () => {
    listIslands.mockResolvedValue([]);
    await render();

    expect(fixture.nativeElement.querySelector('app-empty-state')).not.toBeNull();
    expect(text()).toContain('No language islands available right now.');
  });

  it('shows the error state and retries loading', async () => {
    listIslands.mockRejectedValueOnce(new Error('offline'));
    await render();

    expect(text()).toContain('Could not load language islands.');

    listIslands.mockResolvedValue([japaneseIsland]);
    const retry = (fixture.nativeElement as HTMLElement).querySelector(
      '.retry-button',
    ) as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listIslands).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Japanese Island');
  });

  it('maps language pairs to flags using the shared language catalogue', () => {
    expect(component.getFlag('ja-en')).toBe('🇯🇵');
    expect(component.getFlag('es-en')).toBe('🇪🇸');
    expect(component.getFlag('xx-en')).toBe('🌐');
    expect(component.primaryLanguage('ja-en')).toBe('ja');
  });
});
