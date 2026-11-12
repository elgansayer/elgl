import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { HobbyTag, HobbyTagsService, UserHobbyTag, VocabularyItem } from './hobby-tags.service';

describe('HobbyTagsService', () => {
  let service: HobbyTagsService;
  let http: HttpTestingController;

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
    proficiency_level: 0,
    created_at: '2026-11-08T00:00:00.000Z',
    hobby_tag: tag,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HobbyTagsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the filtered catalogue from the API', async () => {
    const promise = service.getAllTags('Food & Drink');
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/hobby-tags` &&
        candidate.params.get('category') === 'Food & Drink',
    );
    expect(request.request.method).toBe('GET');
    request.flush([tag]);

    await expect(promise).resolves.toEqual([tag]);
  });

  it('propagates catalogue failures instead of substituting mock tags', async () => {
    const promise = service.getAllTags();
    const request = http.expectOne(`${environment.apiUrl}/hobby-tags`);
    request.flush({ message: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });

    await expect(promise).rejects.toMatchObject({ status: 503 });
  });

  it('lets the backend own global-tag normalisation', async () => {
    const promise = service.createGlobalTag('Urban Gardening', 'Lifestyle', '🌱');
    const request = http.expectOne(`${environment.apiUrl}/hobby-tags`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Urban Gardening',
      category: 'Lifestyle',
      icon: '🌱',
    });
    request.flush(tag);

    await expect(promise).resolves.toEqual(tag);
  });

  it('persists a selected tag through the authenticated user endpoint', async () => {
    const promise = service.addMyTag(tag.id, 2);
    const request = http.expectOne(`${environment.apiUrl}/hobby-tags/my`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      hobby_tag_id: tag.id,
      proficiency_level: 2,
    });
    request.flush(userTag);

    await expect(promise).resolves.toEqual(userTag);
  });

  it('uses the backend proficiency route', async () => {
    const promise = service.updateProficiency(tag.id, 2);
    const request = http.expectOne(`${environment.apiUrl}/hobby-tags/my/${tag.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ proficiency_level: 2 });
    request.flush({ ...userTag, proficiency_level: 2 });

    await expect(promise).resolves.toMatchObject({ proficiency_level: 2 });
  });

  it('removes a selected tag only after server confirmation', async () => {
    const promise = service.removeMyTag(tag.id);
    const request = http.expectOne(`${environment.apiUrl}/hobby-tags/my/${tag.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true });

    await expect(promise).resolves.toEqual({ success: true });
  });

  it('requests vocabulary for the selected target language', async () => {
    const vocabulary: VocabularyItem[] = [
      {
        id: 'vocabulary-1',
        word: 'recipe',
        translation: 'receta',
        hobbyTagName: 'Cooking',
        difficulty: 'beginner',
        hobby_tag: { icon: '🍳', name: 'Cooking' },
      },
    ];
    const promise = service.getVocabulary('es');
    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/hobby-tags/vocabulary` &&
        candidate.params.get('language') === 'es',
    );
    expect(request.request.method).toBe('GET');
    request.flush(vocabulary);

    await expect(promise).resolves.toEqual(vocabulary);
  });
});
