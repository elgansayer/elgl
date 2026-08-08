// Mock jsdom and dompurify to avoid ESM import failures in Jest
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation((_html: string) => ({
    window: {
      document: {
        createElement: jest.fn(),
        createDocumentFragment: jest.fn(),
      },
      Node: {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3,
        DOCUMENT_FRAGMENT_NODE: 11,
      },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    },
  })),
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
    },
    setConfig: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ReadingEngineController } from './reading-engine.controller';
import { ReadingEngineService } from './reading-engine.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReadingResourceDto } from './dto/create-reading-resource.dto';
import { UpdateReadingResourceDto } from './dto/update-reading-resource.dto';
import {
  ReadingResource,
  ReadingProgress,
  ReadingTokenBreakdown,
} from './interfaces/reading.interface';

describe('ReadingEngineController', () => {
  let controller: ReadingEngineController;

  const mockService = {
    createResource: jest.fn(),
    listResources: jest.fn(),
    getResource: jest.fn(),
    updateResource: jest.fn(),
    deleteResource: jest.fn(),
    tokenise: jest.fn(),
    getProgress: jest.fn(),
    recordSession: jest.fn(),
    clearUserCaches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadingEngineController],
      providers: [
        {
          provide: ReadingEngineService,
          useValue: mockService,
        },
        { provide: SupabaseService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ReadingEngineController>(ReadingEngineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserId', () => {
    it('should extract userId from req.user.id', () => {
      const req = { user: { id: 'my-id' } };
      expect(controller['getUserId'](req as never)).toBe('my-id');
    });

    it('should return anonymous when no user is present', () => {
      const req = { user: undefined };
      expect(controller['getUserId'](req as never)).toBe('anonymous');
    });
  });

  describe('createResource', () => {
    it('delegates to mockService.createResource with dto', async () => {
      const dto: CreateReadingResourceDto = {
        title: 'Test',
        content: 'Content.',
        language: 'en',
      };
      const mockResource: ReadingResource = {
        id: 'res-1',
        title: 'Test',
        content: 'Content.',
        language: 'en',
        createdBy: 'system',
        createdAt: '',
        updatedAt: '',
      };
      mockService.createResource.mockResolvedValue(mockResource);

      const req = { user: { id: 'user-1' } };
      const result = await controller.createResource(
        dto as never,
        req as never,
      );
      expect(mockService.createResource).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(mockResource);
    });

    it('should delegate to service with extracted user id', async () => {
      const dto = { title: 'Test', content: 'Hello' };
      const expected = { id: '1', title: 'Test' };
      mockService.createResource.mockResolvedValue(expected);
      const req = { user: { id: 'user-1' } };
      const result = await controller.createResource(
        dto as never,
        req as never,
      );
      expect(mockService.createResource).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('listResources', () => {
    it('passes query parameters to mockService.listResources', async () => {
      const mockList: ReadingResource[] = [];
      mockService.listResources.mockResolvedValue(mockList);

      const result = await controller.listResources(
        'en',
        'beginner',
        'science',
        10,
        0,
      );

      expect(result).toEqual(mockList);
      expect(mockService.listResources).toHaveBeenCalledWith({
        language: 'en',
        difficulty: 'beginner',
        topic: 'science',
        limit: 10,
        offset: 0,
      });
      expect(result).toEqual([]);
    });
  });

  describe('getResource', () => {
    it('delegates to mockService.getResource with the id param', async () => {
      const mockResource: ReadingResource = {
        id: 'res-1',
        title: 'T',
        content: 'C',
        language: 'en',
        createdBy: 'u1',
        createdAt: '',
        updatedAt: '',
      };
      mockService.getResource.mockResolvedValue(mockResource);

      const result = await controller.getResource('res-1');

      expect(result).toEqual(mockResource);
      expect(mockService.getResource).toHaveBeenCalledWith('res-1');
    });
  });

  describe('updateResource', () => {
    it('delegates to mockService.updateResource with id and dto', async () => {
      const dto: UpdateReadingResourceDto = { title: 'Updated' };
      const mockResource: ReadingResource = {
        id: 'res-1',
        title: 'Updated',
        content: 'C',
        language: 'en',
        createdBy: 'u1',
        createdAt: '',
        updatedAt: '',
      };
      mockService.updateResource.mockResolvedValue(mockResource);

      const result = await controller.updateResource('res-1', dto);

      expect(result).toEqual(mockResource);
      expect(mockService.updateResource).toHaveBeenCalledWith('res-1', dto);
    });
  });

  describe('deleteResource', () => {
    it('should delegate to service', async () => {
      mockService.deleteResource.mockResolvedValue(undefined);
      await controller.deleteResource('1');
      expect(mockService.deleteResource).toHaveBeenCalledWith('1');
    });
  });

  describe('tokenise', () => {
    it('delegates to mockService.tokenise with id and lang', async () => {
      const breakdown: ReadingTokenBreakdown = {
        resourceId: 'res-1',
        language: 'fr',
        totalTokens: 5,
        uniqueTokens: 4,
        tokens: [],
      };
      mockService.tokenise.mockResolvedValue(breakdown);

      const result = await controller.tokenise('res-1', { user: { id: 'user-2' } } as never, 'fr');

      expect(result).toEqual(breakdown);
      expect(mockService.tokenise).toHaveBeenCalledWith(
        'user-2',
        'res-1',
        'fr',
      );
    });

    it('passes undefined lang when not provided', async () => {
      mockService.tokenise.mockResolvedValue({
        resourceId: 'res-1',
        language: 'en',
        totalTokens: 0,
        uniqueTokens: 0,
        tokens: [],
      });

      await controller.tokenise('res-1', { user: { id: 'user-2' } } as never);

      expect(mockService.tokenise).toHaveBeenCalledWith(
        'user-2',
        'res-1',
        undefined,
      );
    });
  });

  describe('getProgress', () => {
    it('delegates to mockService.getProgress', async () => {
      const progress: ReadingProgress = {
        userId: 'user',
        wordsRead: 100,
        articlesCompleted: 5,
        totalReadingTimeSeconds: 300,
        fluencyPercentage: 75,
      };
      mockService.getProgress.mockResolvedValue(progress);
      const result = await controller.getProgress({
        user: { id: 'user-3' },
      } as never);
      expect(mockService.getProgress).toHaveBeenCalledWith('user-3');
      expect(result).toBe(progress);
    });
  });

  describe('recordSession', () => {
    it('delegates to mockService.recordSession with body', async () => {
      const body = {
        resourceId: 'res-1',
        wordsRead: 100,
        durationSeconds: 300,
      };
      const progress: ReadingProgress = {
        userId: 'user',
        wordsRead: 100,
        articlesCompleted: 1,
        totalReadingTimeSeconds: 300,
        fluencyPercentage: 50,
      };
      mockService.recordSession.mockResolvedValue(progress);
      const result = await controller.recordSession(body, {
        user: { id: 'user-4' },
      } as never);
      expect(mockService.recordSession).toHaveBeenCalledWith('user-4', body);
      expect(result).toBe(progress);
    });
  });

  describe('clearUserCache', () => {
    it('should delegate to service with extracted user id', async () => {
      mockService.clearUserCaches.mockResolvedValue(undefined);
      await controller.clearUserCache({ user: { id: 'user-5' } } as never);
      expect(mockService.clearUserCaches).toHaveBeenCalledWith('user-5');
    });
  });
});
