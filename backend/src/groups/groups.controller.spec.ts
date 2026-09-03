import type { Mocked } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { GroupsController } from './groups.controller';
import {
  GroupsService,
  GroupRecord,
  GroupInfo,
  GroupSettings,
} from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';

describe('GroupsController', () => {
  let controller: GroupsController;

  const mockGroupsService = {
    isAdmin: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    createGroup: vi.fn(),
    updateSettings: vi.fn(),
    getGroupMembers: vi.fn(),
    getSettings: vi.fn(),
    sendAnnouncement: vi.fn(),
    getAnnouncements: vi.fn(),
    getMyAdminGroups: vi.fn(),
    getGroupInfo: vi.fn(),
    getGroupsByInterest: vi.fn(),
    setCommunityId: vi.fn(),
    getGroupsByCommunity: vi.fn(),
    getDiscoverableGroups: vi.fn(),
    joinGroup: vi.fn(),
    getGroupResources: vi.fn(),
    deleteGroupResource: vi.fn(),
    restrictSendMessages: vi.fn(),
    restrictEditInfo: vi.fn(),
  } as unknown as Mocked<GroupsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new GroupsController(mockGroupsService);
  });

  function mockUser(id: string): User {
    return { id } as User;
  }

  describe('create', () => {
    it('should call groupsService.createGroup with the dto mapped fields', async () => {
      const dto: CreateGroupDto = {
        name: 'Study Group',
        community_id: 'community-1',
        interestId: 'interest-1',
        maxMembers: 5,
      };
      const user = { id: 'user-1' } as User;
      mockGroupsService.createGroup.mockResolvedValue({
        id: 'g1',
        name: 'Study Group',
        owner_id: 'user-1',
        community_id: 'community-1',
        interest_id: 'interest-1',
        max_members: 5,
        created_at: '2020-01-01T00:00:00.000Z',
      });

      const result = await controller.create(dto, user);

      expect(mockGroupsService.createGroup).toHaveBeenCalledWith(
        'user-1',
        'Study Group',
        'community-1',
        'interest-1',
        5,
      );
      expect(result).toHaveProperty('id', 'g1');
    });

    it('should pass undefined community_id / interest when not provided', async () => {
      const dto: CreateGroupDto = { name: 'Solo' };
      const user = { id: 'user-2' } as User;
      mockGroupsService.createGroup.mockResolvedValue({} as GroupRecord);

      await controller.create(dto, user);

      expect(mockGroupsService.createGroup).toHaveBeenCalledWith(
        'user-2',
        'Solo',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('getGroups', () => {
    it('should call getGroupsByInterest when interestId query is present', async () => {
      const user = { id: 'user-1' } as User;
      mockGroupsService.getGroupsByInterest.mockResolvedValue([]);

      await controller.getGroups(user, 'interest-123');

      expect(mockGroupsService.getGroupsByInterest).toHaveBeenCalledWith(
        'interest-123',
      );
      expect(mockGroupsService.getDiscoverableGroups).not.toHaveBeenCalled();
    });

    it('should call getDiscoverableGroups when no interestId is supplied', async () => {
      const user = { id: 'user-1' } as User;
      mockGroupsService.getDiscoverableGroups.mockResolvedValue([]);

      await controller.getGroups(user, undefined);

      expect(mockGroupsService.getDiscoverableGroups).toHaveBeenCalledWith(
        'user-1',
      );
      expect(mockGroupsService.getGroupsByInterest).not.toHaveBeenCalled();
    });
  });

  describe('getDiscoverableGroups', () => {
    it('should call service with the current user id', async () => {
      const user = { id: 'user-1' } as User;
      mockGroupsService.getDiscoverableGroups.mockResolvedValue([]);

      await controller.getDiscoverableGroups(user);

      expect(mockGroupsService.getDiscoverableGroups).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('getMembers', () => {
    it('should call getGroupMembers with the group id', async () => {
      mockGroupsService.getGroupMembers.mockResolvedValue([]);

      await controller.getMembers('group-42');

      expect(mockGroupsService.getGroupMembers).toHaveBeenCalledWith(
        'group-42',
      );
    });
  });

  describe('getSettings', () => {
    it('should call getSettings with group id', async () => {
      mockGroupsService.getSettings.mockResolvedValue({} as GroupSettings);

      await controller.getSettings('group-7');

      expect(mockGroupsService.getSettings).toHaveBeenCalledWith('group-7');
    });
  });

  describe('getAnnouncements', () => {
    it('should call getAnnouncements with group id', async () => {
      mockGroupsService.getAnnouncements.mockResolvedValue([]);

      await controller.getAnnouncements('group-3');

      expect(mockGroupsService.getAnnouncements).toHaveBeenCalledWith(
        'group-3',
      );
    });
  });

  describe('getMyAdminGroups', () => {
    it('should call getMyAdminGroups with the current user id', async () => {
      const user = { id: 'user-1' } as User;
      mockGroupsService.getMyAdminGroups.mockResolvedValue([]);

      await controller.getMyAdminGroups(user);

      expect(mockGroupsService.getMyAdminGroups).toHaveBeenCalledWith('user-1');
    });

    it('should throw UnauthorizedException when user is null', async () => {
      await expect(controller.getMyAdminGroups(null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockGroupsService.getMyAdminGroups).not.toHaveBeenCalled();
    });
  });

  describe('getGroupInfo', () => {
    it('should call getGroupInfo with the group id', async () => {
      mockGroupsService.getGroupInfo.mockResolvedValue({} as GroupInfo);

      await controller.getGroupInfo('g-1');

      expect(mockGroupsService.getGroupInfo).toHaveBeenCalledWith('g-1');
    });
  });

  describe('addMember', () => {
    const groupId = 'group-1';
    const dto: AddMemberDto = { memberId: 'member-1' };

    it('should call addMember when requester is admin', async () => {
      const user = { id: 'admin-1' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(true);
      mockGroupsService.addMember.mockResolvedValue(undefined);

      await controller.addMember(groupId, dto, user);

      expect(mockGroupsService.isAdmin).toHaveBeenCalledWith(
        'admin-1',
        groupId,
      );
      expect(mockGroupsService.addMember).toHaveBeenCalledWith(
        groupId,
        'member-1',
        'admin-1',
      );
    });

    it('should throw UnauthorizedException when requester is not admin', async () => {
      const user = { id: 'non-admin' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(false);

      await expect(controller.addMember(groupId, dto, user)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockGroupsService.addMember).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    const groupId = 'group-1';
    const dto: RemoveMemberDto = { memberId: 'member-2' };

    it('should call removeMember when requester is admin', async () => {
      const user = { id: 'admin-1' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(true);
      mockGroupsService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember(groupId, dto, user);

      expect(mockGroupsService.isAdmin).toHaveBeenCalledWith(
        'admin-1',
        groupId,
      );
      expect(mockGroupsService.removeMember).toHaveBeenCalledWith(
        groupId,
        'member-2',
        'admin-1',
      );
    });

    it('should throw UnauthorizedException when requester is not admin', async () => {
      const user = { id: 'non-admin' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(false);

      await expect(controller.removeMember(groupId, dto, user)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockGroupsService.removeMember).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    const groupId = 'group-1';
    const dto: UpdateGroupSettingsDto = {
      can_send_messages: true,
      description: 'Updated',
    };

    it('should call updateSettings when requester is admin', async () => {
      const user = { id: 'admin-1' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(true);
      mockGroupsService.updateSettings.mockResolvedValue(undefined);

      await controller.updateSettings(groupId, dto, user);

      expect(mockGroupsService.isAdmin).toHaveBeenCalledWith(
        'admin-1',
        groupId,
      );
      expect(mockGroupsService.updateSettings).toHaveBeenCalledWith(
        groupId,
        dto,
      );
    });

    it('should throw UnauthorizedException when requester is not admin', async () => {
      const user = { id: 'non-admin' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(false);

      await expect(
        controller.updateSettings(groupId, dto, user),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockGroupsService.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('sendAnnouncement', () => {
    const groupId = 'group-1';
    const dto: SendAnnouncementDto = { message: 'Hello' };

    it('should call sendAnnouncement when requester is admin', async () => {
      const user = { id: 'admin-1' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(true);
      mockGroupsService.sendAnnouncement.mockResolvedValue({ success: true });

      const result = await controller.sendAnnouncement(groupId, dto, user);

      expect(mockGroupsService.isAdmin).toHaveBeenCalledWith(
        'admin-1',
        groupId,
      );
      expect(mockGroupsService.sendAnnouncement).toHaveBeenCalledWith(
        groupId,
        'Hello',
        'admin-1',
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw UnauthorizedException when requester is not admin', async () => {
      const user = { id: 'non-admin' } as User;
      mockGroupsService.isAdmin.mockResolvedValue(false);

      await expect(
        controller.sendAnnouncement(groupId, dto, user),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockGroupsService.sendAnnouncement).not.toHaveBeenCalled();
    });
  });

  describe('joinGroup', () => {
    it('should call joinGroup with group and user ids', async () => {
      const user = { id: 'member-1' } as User;
      mockGroupsService.joinGroup.mockResolvedValue({ success: true });

      const result = await controller.joinGroup('group-5', user);

      expect(mockGroupsService.joinGroup).toHaveBeenCalledWith(
        'group-5',
        'member-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getGroupResources', () => {
    it('should call getGroupResources with group id', async () => {
      mockGroupsService.getGroupResources.mockResolvedValue([]);

      await controller.getGroupResources('group-9');

      expect(mockGroupsService.getGroupResources).toHaveBeenCalledWith(
        'group-9',
      );
    });
  });

  describe('deleteGroupResource', () => {
    it('should call deleteGroupResource with correct args', async () => {
      const user = { id: 'admin-1' } as User;
      mockGroupsService.deleteGroupResource.mockResolvedValue(undefined);

      await controller.deleteGroupResource('group-1', 'resource-1', user);

      expect(mockGroupsService.deleteGroupResource).toHaveBeenCalledWith(
        'group-1',
        'resource-1',
        'admin-1',
      );
    });
  });
});
