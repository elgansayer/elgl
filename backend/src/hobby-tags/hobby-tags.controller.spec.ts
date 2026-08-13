import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HobbyTagsController } from './hobby-tags.controller';
import { HobbyTagsService } from './hobby-tags.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('HobbyTagsController', () => {
  let controller: HobbyTagsController;
  let service: HobbyTagsService;

  const mockTag = {
    id: 'tag-1',
    name: 'Photography',
    category: 'Arts',
    icon: '📸',
    target_vocabulary: [
      { word: 'camera', translation: 'cámara', language: 'es' },
    ],
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

  const mockVocabularyItem = {
    id: 'vocab-1',
    word: 'camera',
    translation: 'cámara',
    hobbyTagName: 'Photography',
    difficulty: 'beginner',
    context_sentence: 'Learn this word from your Photography hobby vocabulary.',
    hobby_tag: { icon: '📸', name: 'Photography' },
  };

  beforeEach(async () => {
    const mockService = {
      getAllTags: vi.fn(),
      createTag: vi.fn(),
      getUserTags: vi.fn(),
      addUserTag: vi.fn(),
      removeUserTag: vi.fn(),
      updateProficiency: vi.fn(),
      getVocabularyForUser: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HobbyTagsController],
      providers: [{ provide: HobbyTagsService, useValue: mockService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<HobbyTagsController>(HobbyTagsController);
    service = module.get<HobbyTagsService>(HobbyTagsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllTags', () => {
    it('should return all tags', async () => {
      (service.getAllTags as Mock).mockResolvedValue([mockTag]);
      const result = await controller.getAllTags();
      expect(result).toEqual([mockTag]);
    });
  });

  describe('createGlobalTag', () => {
    it('should create a global tag', async () => {
      (service.createTag as Mock).mockResolvedValue(mockTag);
      const result = await controller.createGlobalTag({
        name: 'photography',
        category: 'Arts',
        icon: '📸',
      });
      expect(result).toEqual(mockTag);
      expect(service.createTag).toHaveBeenCalledWith(
        'photography',
        'Arts',
        '📸',
      );
    });
  });

  describe('getMyTags', () => {
    it('should return user tags', async () => {
      (service.getUserTags as Mock).mockResolvedValue([mockUserTag]);
      const result = await controller.getMyTags({ user: { id: 'user-1' } });
      expect(result).toEqual([mockUserTag]);
      expect(service.getUserTags).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getVocabulary', () => {
    it('should return vocabulary for user tags', async () => {
      (service.getVocabularyForUser as Mock).mockResolvedValue([
        mockVocabularyItem,
      ]);
      const result = await controller.getVocabulary(
        { user: { id: 'user-1' } },
        'es',
      );
      expect(result).toEqual([mockVocabularyItem]);
      expect(service.getVocabularyForUser).toHaveBeenCalledWith('user-1', 'es');
    });

    it('should pass language query param to service', async () => {
      (service.getVocabularyForUser as Mock).mockResolvedValue([]);
      await controller.getVocabulary({ user: { id: 'user-1' } }, 'fr');
      expect(service.getVocabularyForUser).toHaveBeenCalledWith('user-1', 'fr');
    });
  });

  describe('addTag', () => {
    it('should add a user tag', async () => {
      (service.addUserTag as Mock).mockResolvedValue(mockUserTag);
      const result = await controller.addTag(
        { user: { id: 'user-1' } },
        { hobby_tag_id: 'tag-1', proficiency_level: 2 },
      );
      expect(result).toEqual(mockUserTag);
      expect(service.addUserTag).toHaveBeenCalledWith('user-1', 'tag-1', 2);
    });
  });

  describe('removeTag', () => {
    it('should remove a user tag', async () => {
      (service.removeUserTag as Mock).mockResolvedValue(undefined);
      const result = await controller.removeTag(
        { user: { id: 'user-1' } },
        'tag-1',
      );
      expect(result).toEqual({ message: 'Hobby tag removed successfully' });
      expect(service.removeUserTag).toHaveBeenCalledWith('user-1', 'tag-1');
    });
  });

  describe('updateProficiency', () => {
    it('should update proficiency level', async () => {
      (service.updateProficiency as Mock).mockResolvedValue(mockUserTag);
      const result = await controller.updateProficiency(
        { user: { id: 'user-1' } },
        'tag-1',
        { proficiency_level: 3 },
      );
      expect(result).toEqual(mockUserTag);
      expect(service.updateProficiency).toHaveBeenCalledWith(
        'user-1',
        'tag-1',
        3,
      );
    });
  });
});
