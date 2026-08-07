import { ReadingEngineController } from './reading-engine.controller';

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

  beforeEach(() => {
    controller = new ReadingEngineController(mockService as never);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserId', () => {
    it('should extract userId from req.user.id', () => {
      const req = { user: { id: 'my-id' } };
      expect(controller['getUserId'](req as never)).toBe('my-id');
    });

    it('should fallback to req.user.sub when id is missing', () => {
      const req = { user: { sub: 'my-sub' } };
      expect(controller['getUserId'](req as never)).toBe('my-sub');
    });

    it('should return anonymous when no user is present', () => {
      const req = { user: undefined };
      expect(controller['getUserId'](req as never)).toBe('anonymous');
    });
  });

  describe('createResource', () => {
    it('should delegate to service with extracted user id', async () => {
      const dto = { title: 'Test', content: 'Hello' };
      const expected = { id: '1', title: 'Test' };
      mockService.createResource.mockResolvedValue(expected);
      const req = { user: { id: 'user-1' } };
      const result = await controller.createResource(dto as never, req as never);
      expect(mockService.createResource).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });
  });

  describe('listResources', () => {
    it('should delegate filters to service', async () => {
      mockService.listResources.mockResolvedValue([]);
      const result = await controller.listResources('en', 'beginner', 'science', 10, 0);
      expect(mockService.listResources).toHaveBeenCalledWith({
        language: 'en', difficulty: 'beginner', topic: 'science', limit: 10, offset: 0,
      });
      expect(result).toEqual([]);
    });
  });

  describe('getResource', () => {
    it('should delegate to service', async () => {
      const expected = { id: '1', title: 'Test' };
      mockService.getResource.mockResolvedValue(expected);
      const result = await controller.getResource('1');
      expect(mockService.getResource).toHaveBeenCalledWith('1');
      expect(result).toBe(expected);
    });
  });

  describe('updateResource', () => {
    it('should delegate to service', async () => {
      const dto = { title: 'Updated' };
      const expected = { id: '1', title: 'Updated' };
      mockService.updateResource.mockResolvedValue(expected);
      const result = await controller.updateResource('1', dto as never);
      expect(mockService.updateResource).toHaveBeenCalledWith('1', dto);
      expect(result).toBe(expected);
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
    it('should delegate to service with extracted user id', async () => {
      const expected = { resourceId: '1', language: 'en', totalTokens: 10, uniqueTokens: 5, tokens: [] };
      mockService.tokenise.mockResolvedValue(expected);
      const result = await controller.tokenise('1', 'en', { user: { id: 'user-2' } } as never);
      expect(mockService.tokenise).toHaveBeenCalledWith('user-2', '1', 'en');
      expect(result).toBe(expected);
    });
  });

  describe('getProgress', () => {
    it('should delegate to service with extracted user id', async () => {
      const expected = { userId: 'user-3', wordsRead: 100, articlesCompleted: 5, totalReadingTimeSeconds: 300, fluencyPercentage: 50 };
      mockService.getProgress.mockResolvedValue(expected);
      const result = await controller.getProgress({ user: { id: 'user-3' } } as never);
      expect(mockService.getProgress).toHaveBeenCalledWith('user-3');
      expect(result).toBe(expected);
    });
  });

  describe('recordSession', () => {
    it('should delegate to service with extracted user id', async () => {
      const body = { resourceId: '1', wordsRead: 20, durationSeconds: 60 };
      const expected = { userId: 'user-4', wordsRead: 120, articlesCompleted: 6, totalReadingTimeSeconds: 360, fluencyPercentage: 55 };
      mockService.recordSession.mockResolvedValue(expected);
      const result = await controller.recordSession(body, { user: { id: 'user-4' } } as never);
      expect(mockService.recordSession).toHaveBeenCalledWith('user-4', body);
      expect(result).toBe(expected);
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
