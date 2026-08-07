import { Test, TestingModule } from '@nestjs/testing';
import { HobbyTagsService } from './hobby-tags.service';
import { SupabaseService } from '../supabase/supabase.service';

type SupabaseMock = Record<string, jest.Mock> & { data: unknown; error: unknown; then?: () => void };

function createChainableMock(): SupabaseMock {
  // The Supabase query builder is "thenable" - when awaited without .single(),
  // it acts like a promise resolving to { data, error }.
  const builder: SupabaseMock = {
    data: null,
    error: null,
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    returns: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    neq: jest.fn(),
    then: function (resolve: (value: { data: unknown; error: unknown }) => void) {
      resolve({ data: this.data, error: this.error });
    },
  };

  // Make all jest-mock functions chainable (skip plain functions like `then`)
  for (const key of Object.keys(builder)) {
    const fn = builder[key];
    if (typeof fn === 'function' && typeof fn.mockReturnValue === 'function') {
      fn.mockReturnValue(builder);
    }
  }

  return builder;
}

describe('HobbyTagsService', () => {
  let service: HobbyTagsService;
  let mock: SupabaseMock;

  const mockVocabularyItems = [
    { word: 'camera', translation: 'cámara', language: 'es' },
    { word: 'lens', translation: 'lente', language: 'es' },
    { word: 'camera', translation: 'appareil photo', language: 'fr' },
  ];

  const mockTag = {
    id: 'tag-1',
    name: 'Photography',
    category: 'Arts',
    icon: '📸',
    target_vocabulary: mockVocabularyItems,
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockUserTag = {
    id: 'ut-1',
    user_id: 'user-1',
    hobby_tag_id: 'tag-1',
    proficiency_level: 0,
    created_at: '2026-01-01T00:00:00Z',
    hobby_tag: mockTag,
  };

  beforeEach(async () => {
    mock = createChainableMock();

    const mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HobbyTagsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<HobbyTagsService>(HobbyTagsService);
  });

  describe('getAllTags', () => {
    it('should return all tags ordered by name', async () => {
      mock.data = [mockTag];
      mock.error = null;

      const result = await service.getAllTags();
      expect(result).toEqual([mockTag]);
    });

    it('should return empty array when no tags exist', async () => {
      mock.data = null;
      mock.error = null;

      const result = await service.getAllTags();
      expect(result).toEqual([]);
    });
  });

  describe('createTag', () => {
    it('should create tag with vocabulary for known hobby names', async () => {
      mock.single.mockResolvedValue({
        data: { ...mockTag, name: 'photography' },
        error: null,
      });

      const result = await service.createTag('photography', 'Arts', '📸');
      expect(result.name).toBe('photography');
      expect(result.target_vocabulary).toBeDefined();
      expect(result.target_vocabulary.length).toBeGreaterThan(0);
    });

    it('should create tag with empty vocabulary for unknown hobby names', async () => {
      mock.single.mockResolvedValue({
        data: { ...mockTag, name: 'unknownHobby', target_vocabulary: [] },
        error: null,
      });

      const result = await service.createTag('Unknown Hobby', 'Other', '✨');
      expect(result.name).toBe('unknownHobby');
      expect(result.target_vocabulary).toEqual([]);
    });
  });

  describe('getVocabularyForTag', () => {
    it('should return vocabulary filtered by language', async () => {
      mock.single.mockResolvedValue({
        data: mockTag,
        error: null,
      });

      const result = await service.getVocabularyForTag('tag-1', 'es');
      expect(result).toHaveLength(2);
      expect(result.every((v) => v.language === 'es')).toBe(true);
    });

    it('should throw NotFoundException for missing tag', async () => {
      mock.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.getVocabularyForTag('missing', 'en'),
      ).rejects.toThrow('Hobby tag not found');
    });
  });

  describe('getUserVocabulary', () => {
    it('should return vocabulary for user tags filtered by language', async () => {
      // getUserVocabulary does NOT use .single() - it uses bare thenable
      mock.data = [mockUserTag];
      mock.error = null;

      const result = await service.getUserVocabulary('user-1', 'es');
      expect(result).toHaveLength(2);
      expect(result[0].hobbyTagName).toBe('Photography');
      expect(result[0].hobby_tag).toEqual({
        icon: '📸',
        name: 'Photography',
      });
    });

    it('should return empty array for user with no tags', async () => {
      mock.data = [];
      mock.error = null;

      const result = await service.getUserVocabulary('user-1', 'en');
      expect(result).toEqual([]);
    });
  });

  describe('addUserTag', () => {
    it('should add a user tag', async () => {
      mock.single
        .mockResolvedValueOnce({ data: { id: 'tag-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: mockUserTag, error: null });

      const result = await service.addUserTag('user-1', 'tag-1', 0);
      expect(result).toEqual(mockUserTag);
    });

    it('should throw NotFoundException for invalid tag', async () => {
      mock.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(
        service.addUserTag('user-1', 'invalid-tag'),
      ).rejects.toThrow('Hobby tag not found');
    });

    it('should throw ConflictException for duplicate', async () => {
      mock.single
        .mockResolvedValueOnce({ data: { id: 'tag-1' }, error: null })
        .mockResolvedValueOnce({
          data: { id: 'existing' },
          error: null,
        });

      await expect(
        service.addUserTag('user-1', 'tag-1'),
      ).rejects.toThrow('Hobby tag already added');
    });
  });

  describe('removeUserTag', () => {
    it('should remove a user tag', async () => {
      await expect(
        service.removeUserTag('user-1', 'tag-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateProficiency', () => {
    it('should update proficiency level', async () => {
      const updated = { ...mockUserTag, proficiency_level: 2 };

      mock.single.mockResolvedValue({
        data: updated,
        error: null,
      });

      const result = await service.updateProficiency('user-1', 'tag-1', 2);
      expect(result.proficiency_level).toBe(2);
    });

    it('should throw NotFoundException if user tag not found', async () => {
      mock.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(
        service.updateProficiency('user-1', 'missing-tag', 1),
      ).rejects.toThrow('User hobby tag not found');
    });
  });
});