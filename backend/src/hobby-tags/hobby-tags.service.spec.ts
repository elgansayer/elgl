import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HobbyTagsService } from './hobby-tags.service';
import { SupabaseService } from '../supabase/supabase.service';

function makeBuilder(response: unknown) {
  const builder: any = {};
  for (const method of [
    'insert',
    'select',
    'eq',
    'order',
    'single',
    'delete',
    'update',
    'in',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (
    resolve: (value: unknown) => void,
    reject?: (reason: unknown) => void,
  ) => Promise.resolve(response).then(resolve, reject);
  return builder;
}

describe('HobbyTagsService', () => {
  let service: HobbyTagsService;
  let mockSupabaseClient: any;
  let mockSupabaseService: { getClient: Mock };
  let mockConfigService: { get: Mock };

  beforeEach(async () => {
    mockSupabaseClient = {
      from: vi.fn(),
    };
    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };
    mockConfigService = {
      get: vi.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HobbyTagsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<HobbyTagsService>(HobbyTagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllTags', () => {
    it('should return all hobby tags ordered by name', async () => {
      const tags = [{ id: '1', name: 'Cooking', category: 'Food', icon: '🍳' }];
      const builder = makeBuilder({ data: tags, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getAllTags();
      expect(result).toEqual(tags);
      expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
    });

    it('should return empty array when data is null', async () => {
      const builder = makeBuilder({ data: null, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getAllTags();
      expect(result).toEqual([]);
    });

    it('should throw when supabase returns an error', async () => {
      const builder = makeBuilder({
        data: null,
        error: { message: 'db error' },
      });
      mockSupabaseClient.from.mockReturnValue(builder);

      await expect(service.getAllTags()).rejects.toEqual({
        message: 'db error',
      });
    });
  });

  describe('createTag', () => {
    it('should create a tag with formatted name and empty target_vocabulary', async () => {
      const newTag = {
        id: 'new-1',
        name: 'rockClimbing',
        category: 'Sports',
        icon: '🧗',
      };
      const builder = makeBuilder({ data: newTag, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.createTag('Rock Climbing', 'Sports', '🧗');
      expect(result).toEqual(newTag);
      expect(builder.insert).toHaveBeenCalledWith({
        name: 'rockClimbing',
        category: 'Sports',
        icon: '🧗',
        target_vocabulary: [],
      });
    });

    it('should use default icon when not provided', async () => {
      const newTag = {
        id: 'new-2',
        name: 'reading',
        category: 'Hobby',
        icon: '✨',
      };
      const builder = makeBuilder({ data: newTag, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      await service.createTag('Reading', 'Hobby');
      expect(builder.insert).toHaveBeenCalledWith({
        name: 'reading',
        category: 'Hobby',
        icon: '✨',
        target_vocabulary: [],
      });
    });
  });

  describe('getUserTags', () => {
    it('should return user tags with joined hobby_tag data', async () => {
      const userTags = [
        {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          hobby_tag: { id: '1', name: 'Cooking' },
        },
      ];
      const builder = makeBuilder({ data: userTags, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getUserTags('u1');
      expect(result).toEqual(userTags);
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    });
  });

  describe('addUserTag', () => {
    it('should add a user tag when hobby tag exists and no duplicate', async () => {
      const verifyBuilder = makeBuilder({ data: { id: '1' }, error: null });
      const dupBuilder = makeBuilder({ data: null, error: null });
      const insertBuilder = makeBuilder({
        data: {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          hobby_tag: { id: '1', name: 'Cooking' },
        },
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(verifyBuilder)
        .mockReturnValueOnce(dupBuilder)
        .mockReturnValueOnce(insertBuilder);

      const result = await service.addUserTag('u1', '1', 2);
      expect(result).toBeDefined();
      expect(result.hobby_tag_id).toBe('1');
    });

    it('should throw NotFoundException when hobby tag does not exist', async () => {
      const verifyBuilder = makeBuilder({
        data: null,
        error: { message: 'not found' },
      });
      mockSupabaseClient.from.mockReturnValue(verifyBuilder);

      await expect(service.addUserTag('u1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when tag already added', async () => {
      const verifyBuilder = makeBuilder({ data: { id: '1' }, error: null });
      const dupBuilder = makeBuilder({
        data: { id: 'ut-existing' },
        error: null,
      });
      mockSupabaseClient.from
        .mockReturnValueOnce(verifyBuilder)
        .mockReturnValueOnce(dupBuilder);

      await expect(service.addUserTag('u1', '1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('removeUserTag', () => {
    it('should delete a user tag', async () => {
      const builder = makeBuilder({ error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      await expect(service.removeUserTag('u1', '1')).resolves.toBeUndefined();
      expect(builder.delete).toHaveBeenCalled();
    });

    it('should throw when supabase returns an error', async () => {
      const builder = makeBuilder({ error: { message: 'delete failed' } });
      mockSupabaseClient.from.mockReturnValue(builder);

      await expect(service.removeUserTag('u1', '1')).rejects.toEqual({
        message: 'delete failed',
      });
    });
  });

  describe('updateProficiency', () => {
    it('should update proficiency level', async () => {
      const updated = {
        id: 'ut-1',
        user_id: 'u1',
        hobby_tag_id: '1',
        proficiency_level: 3,
        hobby_tag: { id: '1', name: 'Cooking' },
      };
      const builder = makeBuilder({ data: updated, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.updateProficiency('u1', '1', 3);
      expect(result).toEqual(updated);
      expect(builder.update).toHaveBeenCalledWith({ proficiency_level: 3 });
    });

    it('should throw NotFoundException when user hobby tag not found', async () => {
      const builder = makeBuilder({ data: null, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      await expect(service.updateProficiency('u1', '1', 3)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getVocabularyForUser', () => {
    it('should return vocabulary items from user hobby tags matching language', async () => {
      const userHobbyTags = [
        {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          proficiency_level: 2,
          hobby_tag: {
            id: '1',
            name: 'Cooking',
            category: 'Food',
            icon: '🍳',
            target_vocabulary: [
              { word: 'recipe', translation: 'receta', language: 'es' },
              {
                word: 'ingredient',
                translation: 'ingrediente',
                language: 'es',
              },
              { word: 'chef', translation: 'chef', language: 'fr' },
            ],
          },
        },
      ];
      const builder = makeBuilder({ data: userHobbyTags, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getVocabularyForUser('u1', 'es');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'ut-1-recipe',
        word: 'recipe',
        translation: 'receta',
        hobbyTagName: 'Cooking',
        difficulty: 'beginner',
        context_sentence: undefined,
        hobby_tag: { icon: '🍳', name: 'Cooking' },
      });
      expect(result[1]).toEqual({
        id: 'ut-1-ingredient',
        word: 'ingredient',
        translation: 'ingrediente',
        hobbyTagName: 'Cooking',
        difficulty: 'beginner',
        context_sentence: undefined,
        hobby_tag: { icon: '🍳', name: 'Cooking' },
      });
    });

    it('should return empty array when user has no hobby tags', async () => {
      const builder = makeBuilder({ data: [], error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getVocabularyForUser('u1', 'es');
      expect(result).toEqual([]);
    });

    it('should return empty array when no vocabulary matches language and no base vocab', async () => {
      const userHobbyTags = [
        {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          hobby_tag: {
            id: '1',
            name: 'CustomTagNoBase',
            icon: '🎯',
            target_vocabulary: [
              { word: 'recipe', translation: 'receta', language: 'es' },
            ],
          },
        },
      ];
      const builder = makeBuilder({ data: userHobbyTags, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getVocabularyForUser('u1', 'fr');
      expect(result).toEqual([]);
    });

    it('should handle null target_vocabulary gracefully and no base vocab', async () => {
      const userHobbyTags = [
        {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          hobby_tag: {
            id: '1',
            name: 'CustomTagNoBase',
            icon: '🎯',
            target_vocabulary: null,
          },
        },
      ];
      const builder = makeBuilder({ data: userHobbyTags, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getVocabularyForUser('u1', 'es');
      expect(result).toEqual([]);
    });

    it('should dynamically translate using base vocabulary when no cached translation exists for language', async () => {
      const userHobbyTags = [
        {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          proficiency_level: 2,
          hobby_tag: {
            id: '1',
            name: 'Cooking',
            category: 'Food',
            icon: '🍳',
            target_vocabulary: [
              { word: 'recipe', translation: 'receta', language: 'es' },
            ],
          },
        },
      ];

      mockConfigService.get.mockReturnValue('mock-deepl-key');

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            translations: [
              { text: '레시피' },
              { text: '재료' },
              { text: '끓이다' },
              { text: '썰다' },
              { text: '굽다' },
            ],
          }),
      });
      globalThis.fetch = fetchMock as any;

      const builder = makeBuilder({ data: userHobbyTags, error: null });
      const updateBuilder = makeBuilder({ data: null, error: null });
      mockSupabaseClient.from
        .mockReturnValueOnce(builder) // get user hobby tags
        .mockReturnValue(updateBuilder); // subsequent from() for cache update

      const result = await service.getVocabularyForUser('u1', 'ko');
      expect(result).toHaveLength(5);
      expect(result[0].word).toBe('recipe');
      expect(result[0].translation).toBe('레시피');
      expect(result[1].word).toBe('ingredient');
      expect(result[1].translation).toBe('재료');
      expect(result[0].hobbyTagName).toBe('Cooking');
    });

    it('should skip user tags with null hobby_tag', async () => {
      const userHobbyTags = [
        {
          id: 'ut-1',
          user_id: 'u1',
          hobby_tag_id: '1',
          hobby_tag: null,
        },
        {
          id: 'ut-2',
          user_id: 'u1',
          hobby_tag_id: '2',
          hobby_tag: {
            id: '2',
            name: 'Music',
            icon: '🎵',
            target_vocabulary: [
              { word: 'melody', translation: 'melodía', language: 'es' },
            ],
          },
        },
      ];
      const builder = makeBuilder({ data: userHobbyTags, error: null });
      mockSupabaseClient.from.mockReturnValue(builder);

      const result = await service.getVocabularyForUser('u1', 'es');
      expect(result).toHaveLength(1);
      expect(result[0].word).toBe('melody');
    });

    it('should throw when supabase returns an error', async () => {
      const builder = makeBuilder({
        data: null,
        error: { message: 'db error' },
      });
      mockSupabaseClient.from.mockReturnValue(builder);

      await expect(service.getVocabularyForUser('u1', 'es')).rejects.toEqual({
        message: 'db error',
      });
    });
  });
});
