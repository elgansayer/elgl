import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageIslandsComponent } from './language-islands.component';
import { LanguageIsland, LanguageIslandsService } from '../../services/language-islands.service';
import { I18nService } from '../../services/i18n.service';

describe('LanguageIslandsComponent', () => {
  let component: LanguageIslandsComponent;
  let fixture: ComponentFixture<LanguageIslandsComponent>;
  let mockLanguageIslandsService: {
    listIslands: ReturnType<typeof vi.fn>;
    joinIsland: ReturnType<typeof vi.fn>;
    leaveIsland: ReturnType<typeof vi.fn>;
  };

  const mockIslands: LanguageIsland[] = [
    {
      id: 'island-1',
      name: 'Japanese Island',
      description: '128 practising now · beginner-friendly',
      language_pair: 'ja-en',
      host_id: 'host-1',
      max_members: 500,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      member_count: 128,
    },
    {
      id: 'island-2',
      name: 'Spanish Island',
      description: '204 practising now',
      language_pair: 'es-en',
      host_id: 'host-2',
      max_members: 500,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      member_count: 204,
    },
  ];

  beforeEach(async () => {
    mockLanguageIslandsService = {
      listIslands: vi.fn().mockResolvedValue(mockIslands),
      joinIsland: vi.fn().mockResolvedValue(undefined),
      leaveIsland: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LanguageIslandsComponent],
      providers: [
        {
          provide: LanguageIslandsService,
          useValue: mockLanguageIslandsService,
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: () => 'en-GB',
            translate: (key: string, params?: Record<string, unknown>) => {
              if (params && 'count' in params) {
                return `${key}:${params['count']}`;
              }
              if (params && 'name' in params) {
                return `${key}:${params['name']}`;
              }
              return key;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageIslandsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads and renders islands from service', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Japanese Island');
    expect(element.textContent).toContain('Spanish Island');
    expect(element.textContent).toContain('128');
    expect(element.textContent).toContain('204');
  });

  it('filters islands by language', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.selectLanguage('ja');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.filteredIslands().length).toBe(1);
    expect(component.filteredIslands()[0]?.name).toBe('Japanese Island');

    component.selectLanguage('all');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.filteredIslands().length).toBe(2);
  });

  it('does not report joined when the join request fails', async () => {
    mockLanguageIslandsService.joinIsland.mockRejectedValue(new Error('x'));
    await component.enterIsland(mockIslands[0]!);
    expect(component.enteredIslandId()).toBeNull();
    expect(component.actionFailed()).toBe(true);
  });

  it('enters island and sets joined state', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.enterIsland(mockIslands[0]!);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockLanguageIslandsService.joinIsland).toHaveBeenCalledWith('island-1');
    expect(component.enteredIslandId()).toBe('island-1');
    expect(component.statusMessage()).toBe('Japanese Island');

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('languageIslands.joined');
  });

  it('leaves island and clears joined state', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.enterIsland(mockIslands[0]!);
    expect(component.enteredIslandId()).toBe('island-1');

    await component.leaveIsland(mockIslands[0]!);
    expect(mockLanguageIslandsService.leaveIsland).toHaveBeenCalledWith('island-1');
    expect(component.enteredIslandId()).toBeNull();
    expect(component.statusMessage()).toBeNull();
  });

  it('returns flag emoji corresponding to language pair', () => {
    expect(component.getFlag('ja-en')).toBe('🇯🇵');
    expect(component.getFlag('es-en')).toBe('🇪🇸');
    expect(component.getFlag('ar-en')).toBe('🇸🇦');
    expect(component.getFlag('fr-en')).toBe('🇫🇷');
    expect(component.getFlag('de-en')).toBe('🇩🇪');
    expect(component.getFlag('unknown')).toBe('🌐');
  });
});
