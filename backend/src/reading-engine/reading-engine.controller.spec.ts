import { Test, TestingModule } from '@nestjs/testing';
import { ReadingEngineController } from './reading-engine.controller';
import { ReadingEngineService } from './reading-engine.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReadingResourceDto } from './dto/create-reading-resource.dto';
import { UpdateReadingResourceDto } from './dto/update-reading-resource.dto';
import { ReadingResource, ReadingProgress, ReadingTokenBreakdown } from './interfaces/reading.interface';

describe('ReadingEngineController', () => {
  let controller: ReadingEngineController;
  let readingService: jest.Mocked<ReadingEngineService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadingEngineController],
      providers: [
        {
          provide: ReadingEngineService,
          useValue: {
            createResource: jest.fn(),
            updateResource: jest.fn(),
            getResource: jest.fn(),
            listResources: jest.fn(),
            deleteResource: jest.fn(),
            tokenise: jest.fn(),
            getProgress: jest.fn(),
            recordSession: jest.fn(),
            clearUserCaches: jest.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: { getClient: jest.fn().mockReturnValue({}) },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ReadingEngineController>(ReadingEngineController);
    readingService = module.get(ReadingEngineService) as jest.Mocked<ReadingEngineService>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  /* ------------------------------------------------------------------ */
  /*  createResource                                                    */
  /* ------------------------------------------------------------------ */

  describe('createResource', () => {
    it('delegates to readingService.createResource with dto', async () => {
      const dto: CreateReadingResourceDto = {
        title: 'Test',
        content: 'Content.',
        language: 'en',
      };
      const mockResource: ReadingResource = {
        id: 'res-1', title: 'Test', content: 'Content.', language: 'en',
        createdBy: 'system', createdAt: '', updatedAt: '',
      };
      readingService.createResource.mockResolvedValue(mockResource);

      const result = await controller.createResource(dto);

      expect(result).toEqual(mockResource);
      expect(readingService.createResource).toHaveBeenCalledWith('system', dto);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  listResources                                                     */
  /* ------------------------------------------------------------------ */

  describe('listResources', () => {
    it('passes query parameters to readingService.listResources', async () => {
      const mockList: ReadingResource[] = [];
      readingService.listResources.mockResolvedValue(mockList);

      const result = await controller.listResources('en', 'beginner', 'science', 10, 0);

      expect(result).toEqual(mockList);
      expect(readingService.listResources).toHaveBeenCalledWith({
        language: 'en',
        difficulty: 'beginner',
        topic: 'science',
        limit: 10,
        offset: 0,
      });
    });

    it('handles undefined query parameters gracefully', async () => {
      readingService.listResources.mockResolvedValue([]);

      await controller.listResources();

      expect(readingService.listResources).toHaveBeenCalledWith({
        language: undefined,
        difficulty: undefined,
        topic: undefined,
        limit: undefined,
        offset: undefined,
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getResource                                                       */
  /* ------------------------------------------------------------------ */

  describe('getResource', () => {
    it('delegates to readingService.getResource with the id param', async () => {
      const mockResource: ReadingResource = {
        id: 'res-1', title: 'T', content: 'C', language: 'en',
        createdBy: 'u1', createdAt: '', updatedAt: '',
      };
      readingService.getResource.mockResolvedValue(mockResource);

      const result = await controller.getResource('res-1');

      expect(result).toEqual(mockResource);
      expect(readingService.getResource).toHaveBeenCalledWith('res-1');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  updateResource                                                    */
  /* ------------------------------------------------------------------ */

  describe('updateResource', () => {
    it('delegates to readingService.updateResource with id and dto', async () => {
      const dto: UpdateReadingResourceDto = { title: 'Updated' };
      const mockResource: ReadingResource = {
        id: 'res-1', title: 'Updated', content: 'C', language: 'en',
        createdBy: 'u1', createdAt: '', updatedAt: '',
      };
      readingService.updateResource.mockResolvedValue(mockResource);

      const result = await controller.updateResource('res-1', dto);

      expect(result).toEqual(mockResource);
      expect(readingService.updateResource).toHaveBeenCalledWith('res-1', dto);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteResource                                                    */
  /* ------------------------------------------------------------------ */

  describe('deleteResource', () => {
    it('delegates to readingService.deleteResource', async () => {
      readingService.deleteResource.mockResolvedValue(undefined);

      await controller.deleteResource('res-1');

      expect(readingService.deleteResource).toHaveBeenCalledWith('res-1');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  tokenise                                                          */
  /* ------------------------------------------------------------------ */

  describe('tokenise', () => {
    it('delegates to readingService.tokenise with id and lang', async () => {
      const breakdown: ReadingTokenBreakdown = {
        resourceId: 'res-1', language: 'fr', totalTokens: 5, uniqueTokens: 4, tokens: [],
      };
      readingService.tokenise.mockResolvedValue(breakdown);

      const result = await controller.tokenise('res-1', 'fr');

      expect(result).toEqual(breakdown);
      expect(readingService.tokenise).toHaveBeenCalledWith('user', 'res-1', 'fr');
    });

    it('passes undefined lang when not provided', async () => {
      readingService.tokenise.mockResolvedValue({
        resourceId: 'res-1', language: 'en', totalTokens: 0, uniqueTokens: 0, tokens: [],
      });

      await controller.tokenise('res-1');

      expect(readingService.tokenise).toHaveBeenCalledWith('user', 'res-1', undefined);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  getProgress                                                       */
  /* ------------------------------------------------------------------ */

  describe('getProgress', () => {
    it('delegates to readingService.getProgress', async () => {
      const progress: ReadingProgress = {
        userId: 'user', wordsRead: 100, articlesCompleted: 5,
        totalReadingTimeSeconds: 300, fluencyPercentage: 75,
      };
      readingService.getProgress.mockResolvedValue(progress);

      const result = await controller.getProgress();

      expect(result).toEqual(progress);
      expect(readingService.getProgress).toHaveBeenCalledWith('user');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  recordSession                                                     */
  /* ------------------------------------------------------------------ */

  describe('recordSession', () => {
    it('delegates to readingService.recordSession with body', async () => {
      const body = { resourceId: 'res-1', wordsRead: 100, durationSeconds: 300 };
      const progress: ReadingProgress = {
        userId: 'user', wordsRead: 100, articlesCompleted: 1,
        totalReadingTimeSeconds: 300, fluencyPercentage: 50,
      };
      readingService.recordSession.mockResolvedValue(progress);

      const result = await controller.recordSession(body);

      expect(result).toEqual(progress);
      expect(readingService.recordSession).toHaveBeenCalledWith('user', body);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clearUserCache                                                    */
  /* ------------------------------------------------------------------ */

  describe('clearUserCache', () => {
    it('delegates to readingService.clearUserCaches', async () => {
      readingService.clearUserCaches.mockResolvedValue(undefined);

      await controller.clearUserCache();

      expect(readingService.clearUserCaches).toHaveBeenCalledWith('user');
    });
  });
});