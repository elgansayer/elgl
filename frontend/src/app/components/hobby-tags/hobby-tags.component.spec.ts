import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../services/i18n.service';
import {
  HobbyTag,
  HobbyTagsService,
  UserHobbyTag,
  VocabularyItem,
} from '../../services/hobby-tags.service';
import { HobbyTagsComponent } from './hobby-tags.component';

describe('HobbyTagsComponent', () => {
  let fixture: ComponentFixture<HobbyTagsComponent>;

  const tag: HobbyTag = {
    id: '9f86d081-884c-4d65-a0c7-6e9c0bbdb915',
    name: 'Cooking',
    category: 'Food & Drink',
    icon: '🍳',
    target_vocabulary: [{ word: 'recipe', translation: 'receta', language: 'es' }],
    created_at: '2026-11-08T00:00:00.000Z',
  };

  const userTag: UserHobbyTag = {
    id: '45c48cce-4e16-4ac3-9ccd-5b3508b631ac',
    user_id: 'f5bc7295-25cc-40a7-82db-31aab1b1e193',
    hobby_tag_id: tag.id,
    proficiency_level: 1,
    created_at: '2026-11-08T00:00:00.000Z',
    hobby_tag: tag,
  };

  const vocabulary: VocabularyItem = {
    id: 'vocabulary-1',
    word: 'recipe',
    translation: 'receta',
    hobbyTagName: 'Cooking',
    difficulty: 'beginner',
    hobby_tag: { icon: '🍳', name: 'Cooking' },
  };

  const hobbyTagsService = {
    getAllTags: vi.fn<() => Promise<HobbyTag[]>>(),
    getMyTags: vi.fn<() => Promise<UserHobbyTag[]>>(),
    getVocabulary: vi.fn<() => Promise<VocabularyItem[]>>(),
    addMyTag: vi.fn<() => Promise<UserHobbyTag>>(),
    removeMyTag: vi.fn<() => Promise<{ success: boolean }>>(),
    createGlobalTag: vi.fn<() => Promise<HobbyTag>>(),
    updateProficiency: vi.fn<() => Promise<UserHobbyTag>>(),
  };

  const i18n = {
    translate: (key: string, params?: Record<string, unknown>) =>
      params?.['name'] ? `${key}:${params['name']}` : key,
  };

  beforeEach(async () => {
    hobbyTagsService.getAllTags.mockReset().mockResolvedValue([tag]);
    hobbyTagsService.getMyTags.mockReset().mockResolvedValue([]);
    hobbyTagsService.getVocabulary.mockReset().mockResolvedValue([vocabulary]);
    hobbyTagsService.addMyTag.mockReset().mockResolvedValue(userTag);
    hobbyTagsService.removeMyTag.mockReset().mockResolvedValue({ success: true });
    hobbyTagsService.createGlobalTag.mockReset().mockResolvedValue(tag);
    hobbyTagsService.updateProficiency.mockReset().mockResolvedValue(userTag);

    await TestBed.configureTestingModule({
      imports: [HobbyTagsComponent],
      providers: [
        { provide: HobbyTagsService, useValue: hobbyTagsService },
        { provide: I18nService, useValue: i18n },
      ],
    }).compileComponents();
  });

  async function render(): Promise<HobbyTagsComponent> {
    fixture = TestBed.createComponent(HobbyTagsComponent);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('loads persisted tags and target-language vocabulary', async () => {
    const component = await render();

    expect(hobbyTagsService.getAllTags).toHaveBeenCalledOnce();
    expect(hobbyTagsService.getMyTags).toHaveBeenCalledOnce();
    expect(hobbyTagsService.getVocabulary).toHaveBeenCalledWith('en');
    expect(component.allTags()).toEqual([tag]);
    expect(component.userVocabulary()).toEqual([vocabulary]);
    expect(fixture.nativeElement.textContent).toContain('recipe');
    expect(fixture.nativeElement.textContent).toContain('receta');
  });

  it('shows a persistent translated search label without placeholder-only guidance', async () => {
    const component = await render();
    component.showAddPanel.set(true);
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('#hobby-search');
    const label = fixture.nativeElement.querySelector('label[for="hobby-search"]');
    expect(label?.textContent).toContain('hobby.searchLabel');
    expect(search?.hasAttribute('placeholder')).toBe(false);
  });

  it('surfaces load failure and retries the real API path', async () => {
    hobbyTagsService.getAllTags.mockRejectedValueOnce(new Error('provider unavailable'));
    await render();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('hobby.loadError');

    const retry = alert?.querySelector('button');
    retry?.click();
    await fixture.whenStable();

    expect(hobbyTagsService.getAllTags).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('persists a selected tag and reloads server-confirmed state', async () => {
    await render();
    const openPanel = fixture.nativeElement.querySelector('button');
    openPanel?.click();
    await fixture.whenStable();

    const add = fixture.nativeElement.querySelector('[aria-label="hobby.addTagLabel:Cooking"]');
    add?.click();
    await fixture.whenStable();

    expect(hobbyTagsService.addMyTag).toHaveBeenCalledWith(tag.id, 0);
    expect(hobbyTagsService.getMyTags).toHaveBeenCalledTimes(2);
  });

  it('does not convert a failed mutation into local success', async () => {
    hobbyTagsService.addMyTag.mockRejectedValueOnce(new Error('write failed'));
    const component = await render();

    await component.addTag(tag.id);
    await fixture.whenStable();

    expect(component.userTags()).toEqual([]);
    expect(component.actionError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('hobby.actionError');
  });

  it('suppresses conflicting concurrent mutations', async () => {
    let completeMutation: ((value: UserHobbyTag) => void) | undefined;
    hobbyTagsService.addMyTag.mockImplementationOnce(
      () =>
        new Promise<UserHobbyTag>((resolve) => {
          completeMutation = resolve;
        }),
    );
    const component = await render();

    const first = component.addTag(tag.id);
    const second = component.addTag(tag.id);
    expect(hobbyTagsService.addMyTag).toHaveBeenCalledOnce();

    completeMutation?.(userTag);
    await Promise.all([first, second]);
  });

  it('opens the proficiency control from an accessible tag button', async () => {
    hobbyTagsService.getMyTags.mockResolvedValue([userTag]);
    await render();

    const edit = fixture.nativeElement.querySelector(
      '[aria-label="hobby.editProficiencyLabel:Cooking"]',
    );
    edit?.click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).not.toBeNull();
  });
});
