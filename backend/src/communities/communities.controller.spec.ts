import { CommunitiesController } from './communities.controller';
import { CreateCommunityDto } from '../groups/dto/create-community.dto';
import { UpdateCommunityDto } from '../groups/dto/update-community.dto';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;
  const service = {
    create: vi.fn(),
    findById: vi.fn(),
    listByOwner: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addGroup: vi.fn(),
    removeGroup: vi.fn(),
    getGroups: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new CommunitiesController(service);
  });

  describe('create', () => {
    it('should call service.create with ownerId and dto', async () => {
      const dto = { name: 'Test Community' } as CreateCommunityDto;
      const req = { user: { id: 'user-123' } };
      const expectedResult = { id: 'community-1' };

      service.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith('user-123', dto);
      expect(result).toEqual(expectedResult);
    });

    it('should propagate service errors', async () => {
      const dto = { name: 'Failing Community' } as CreateCommunityDto;
      const req = { user: { id: 'user-456' } };
      const error = new Error('creation failed');

      service.create.mockRejectedValue(error);

      await expect(controller.create(dto, req as any)).rejects.toThrow(
        new Error('creation failed'),
      );
    });
  });

  describe('find', () => {
    it('should call service.findById with the communityId', async () => {
      const communityId = 'community-42';
      const expectedResult = { id: communityId, name: 'Found community' };

      service.findById.mockResolvedValue(expectedResult);

      const result = await controller.find(communityId);

      expect(service.findById).toHaveBeenCalledWith(communityId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('listMine', () => {
    it('should call service.listByOwner with the authenticated user id', async () => {
      const req = { user: { id: 'owner-987' } };
      const expectedResult = [
        { id: 'community-1', name: 'Community One' },
        { id: 'community-2', name: 'Community Two' },
      ];

      service.listByOwner.mockResolvedValue(expectedResult);

      const result = await controller.listMine(req);

      expect(service.listByOwner).toHaveBeenCalledWith('owner-987');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should call service.update with communityId, dto and userId', async () => {
      const communityId = 'community-99';
      const dto = { name: 'Updated name' } as UpdateCommunityDto;
      const req = { user: { id: 'user-updater' } };

      service.update.mockResolvedValue(undefined);

      const result = await controller.update(communityId, dto, req);

      expect(service.update).toHaveBeenCalledWith(
        communityId,
        dto,
        'user-updater',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('remove', () => {
    it('should call service.delete with communityId and userId', async () => {
      const communityId = 'community-delete';
      const req = { user: { id: 'user-deleter' } };

      service.delete.mockResolvedValue(undefined);

      await controller.remove(communityId, req);

      expect(service.delete).toHaveBeenCalledWith(communityId, 'user-deleter');
    });
  });

  describe('addGroup', () => {
    it('should call service.addGroup with communityId and groupId', async () => {
      const communityId = 'community-group';
      const dto = { groupId: 'group-777' };
      const expectedResult = { id: 'association-1' };

      service.addGroup.mockResolvedValue(expectedResult);

      const result = await controller.addGroup(communityId, dto);

      expect(service.addGroup).toHaveBeenCalledWith(communityId, dto.groupId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removeGroup', () => {
    it('should call service.removeGroup with the supplied groupId', async () => {
      const groupId = 'group-888';
      const expectedResult = { success: true };

      service.removeGroup.mockResolvedValue(expectedResult);

      const result = await controller.removeGroup(groupId);

      expect(service.removeGroup).toHaveBeenCalledWith(groupId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getGroups', () => {
    it('should call service.getGroups with the communityId', async () => {
      const communityId = 'community-groups';
      const expectedResult = [
        { id: 'group-1', name: 'Group 1' },
        { id: 'group-2', name: 'Group 2' },
      ];

      service.getGroups.mockResolvedValue(expectedResult);

      const result = await controller.getGroups(communityId);

      expect(service.getGroups).toHaveBeenCalledWith(communityId);
      expect(result).toEqual(expectedResult);
    });
  });
});
