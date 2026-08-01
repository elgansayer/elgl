import { Test, TestingModule } from '@nestjs/testing';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

describe('GroupsController', () => {
  let controller: GroupsController;
  let groupsService: GroupsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [
        {
          provide: GroupsService,
          useValue: {
            createGroup: jest.fn(),
            renameGroup: jest.fn(),
            addGroupMembers: jest.fn(),
            removeGroupMember: jest.fn(),
            getGroupMembers: jest.fn(),
            generateInviteCode: jest.fn(),
            generateInviteLink: jest.fn(),
            getInviteInfo: jest.fn(),
            sendAnnouncement: jest.fn(),
            getAnnouncements: jest.fn(),
            joinByInviteCode: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<GroupsController>(GroupsController);
    groupsService = module.get<GroupsService>(GroupsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createGroup', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createGroup(null, {} as any);
      expect(result).toBeNull();
      expect(groupsService.createGroup).not.toHaveBeenCalled();
    });

    it('should call groupsService.createGroup when user is provided', async () => {
      const dto: any = { name: 'Study group', memberIds: ['user-2'] };
      const room: any = { id: 'room-1', title: 'Study group' };
      (groupsService.createGroup as jest.Mock).mockResolvedValue(room);

      const result = await controller.createGroup({ id: 'user-1' } as any, dto);
      expect(groupsService.createGroup).toHaveBeenCalledWith(
        'user-1',
        dto.name,
        dto.memberIds,
      );
      expect(result).toEqual(room);
    });
  });

  describe('renameGroup', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.renameGroup(null, 'room-1', {
        name: 'New name',
      });
      expect(result).toBeNull();
      expect(groupsService.renameGroup).not.toHaveBeenCalled();
    });

    it('should call groupsService.renameGroup when user is provided', async () => {
      (groupsService.renameGroup as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.renameGroup(
        { id: 'user-1' } as any,
        'room-1',
        { name: 'New name' },
      );
      expect(groupsService.renameGroup).toHaveBeenCalledWith(
        'user-1',
        'room-1',
        'New name',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('addGroupMembers', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.addGroupMembers(null, 'room-1', {
        memberIds: ['user-2'],
      });
      expect(result).toBeNull();
      expect(groupsService.addGroupMembers).not.toHaveBeenCalled();
    });

    it('should call groupsService.addGroupMembers when user is provided', async () => {
      (groupsService.addGroupMembers as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.addGroupMembers(
        { id: 'user-1' } as any,
        'room-1',
        { memberIds: ['user-2', 'user-3'] },
      );
      expect(groupsService.addGroupMembers).toHaveBeenCalledWith(
        'user-1',
        'room-1',
        ['user-2', 'user-3'],
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('removeGroupMember', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.removeGroupMember(
        null,
        'room-1',
        'user-2',
      );
      expect(result).toBeNull();
      expect(groupsService.removeGroupMember).not.toHaveBeenCalled();
    });

    it('should call groupsService.removeGroupMember when user is provided', async () => {
      (groupsService.removeGroupMember as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.removeGroupMember(
        { id: 'user-1' } as any,
        'room-1',
        'user-2',
      );
      expect(groupsService.removeGroupMember).toHaveBeenCalledWith(
        'user-1',
        'room-1',
        'user-2',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getGroupMembers', () => {
    it('should return an empty array if user is not provided', async () => {
      const result = await controller.getGroupMembers(null, 'room-1');
      expect(result).toEqual([]);
      expect(groupsService.getGroupMembers).not.toHaveBeenCalled();
    });

    it('should call groupsService.getGroupMembers when user is provided', async () => {
      const members = [{ user_id: 'user-2' }];
      (groupsService.getGroupMembers as jest.Mock).mockResolvedValue(members);

      const result = await controller.getGroupMembers(
        { id: 'user-1' } as any,
        'room-1',
      );
      expect(groupsService.getGroupMembers).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(members);
    });
  });

  describe('generateInviteCode', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.generateInviteCode(null, 'room-1');
      expect(result).toBeNull();
      expect(groupsService.generateInviteCode).not.toHaveBeenCalled();
    });

    it('should call groupsService.generateInviteCode when user is provided', async () => {
      (groupsService.generateInviteCode as jest.Mock).mockResolvedValue(
        'abc123',
      );

      const result = await controller.generateInviteCode(
        { id: 'user-1' } as any,
        'room-1',
      );
      expect(groupsService.generateInviteCode).toHaveBeenCalledWith(
        'user-1',
        'room-1',
      );
      expect(result).toEqual({ code: 'abc123' });
    });
  });

  describe('generateInviteLink', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.generateInviteLink(null, 'room-1');
      expect(result).toBeNull();
      expect(groupsService.generateInviteLink).not.toHaveBeenCalled();
    });

    it('should call groupsService.generateInviteLink when user is provided', async () => {
      const inviteLink = {
        code: 'abc123',
        url: 'http://localhost:4200/join/abc123',
      };
      (groupsService.generateInviteLink as jest.Mock).mockResolvedValue(
        inviteLink,
      );

      const result = await controller.generateInviteLink(
        { id: 'user-1' } as any,
        'room-1',
      );
      expect(groupsService.generateInviteLink).toHaveBeenCalledWith(
        'user-1',
        'room-1',
      );
      expect(result).toEqual(inviteLink);
    });
  });

  describe('getInviteInfo', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getInviteInfo(null, 'abc123');
      expect(result).toBeNull();
      expect(groupsService.getInviteInfo).not.toHaveBeenCalled();
    });

    it('should call groupsService.getInviteInfo when user is provided', async () => {
      const inviteInfo = { roomId: 'room-1', title: 'Study group' };
      (groupsService.getInviteInfo as jest.Mock).mockResolvedValue(inviteInfo);

      const result = await controller.getInviteInfo(
        { id: 'user-1' } as any,
        'abc123',
      );
      expect(groupsService.getInviteInfo).toHaveBeenCalledWith('abc123');
      expect(result).toEqual(inviteInfo);
    });
  });

  describe('sendAnnouncement', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.sendAnnouncement(null, 'room-1', {
        message: 'Hello',
      });
      expect(result).toBeNull();
      expect(groupsService.sendAnnouncement).not.toHaveBeenCalled();
    });

    it('should call groupsService.sendAnnouncement when user is provided', async () => {
      (groupsService.sendAnnouncement as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.sendAnnouncement(
        { id: 'user-1' } as any,
        'room-1',
        { message: 'Hello everyone' },
      );
      expect(groupsService.sendAnnouncement).toHaveBeenCalledWith(
        'user-1',
        'room-1',
        'Hello everyone',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getAnnouncements', () => {
    it('should return an empty array if user is not provided', async () => {
      const result = await controller.getAnnouncements(null, 'room-1');
      expect(result).toEqual([]);
      expect(groupsService.getAnnouncements).not.toHaveBeenCalled();
    });

    it('should call groupsService.getAnnouncements when user is provided', async () => {
      const announcements = [
        {
          id: 'ann-1',
          message: 'Hello everyone',
          createdAt: '2026-08-01T00:00:00.000Z',
          senderId: 'user-1',
        },
      ];
      (groupsService.getAnnouncements as jest.Mock).mockResolvedValue(
        announcements,
      );

      const result = await controller.getAnnouncements(
        { id: 'user-1' } as any,
        'room-1',
      );
      expect(groupsService.getAnnouncements).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(announcements);
    });
  });

  describe('joinByInviteCode', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.joinByInviteCode(null, {
        code: 'abc123',
      });
      expect(result).toBeNull();
      expect(groupsService.joinByInviteCode).not.toHaveBeenCalled();
    });

    it('should call groupsService.joinByInviteCode when user is provided', async () => {
      (groupsService.joinByInviteCode as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await controller.joinByInviteCode(
        { id: 'user-1' } as any,
        { code: 'abc123' },
      );
      expect(groupsService.joinByInviteCode).toHaveBeenCalledWith(
        'user-1',
        'abc123',
      );
      expect(result).toEqual({ success: true });
    });
  });
});
