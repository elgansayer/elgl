import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SystemMessageService } from './services/system-message.service';

type QueryBuilder = {
  select: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  eq: Mock;
  match: Mock;
  order: Mock;
  single: Mock;
  maybeSingle: Mock;
  then: Mock;
};

function createQueryBuilder(
  resolved: { data?: unknown; error?: unknown; count?: number } = {
    data: null,
    error: null,
  },
): QueryBuilder {
  const builder: Partial<QueryBuilder> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.update = vi.fn().mockReturnValue(builder);
  builder.delete = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.match = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.single = vi.fn().mockResolvedValue(resolved);
  builder.maybeSingle = vi.fn().mockResolvedValue(resolved);
  builder.then = vi.fn((resolve: (v: typeof resolved) => unknown) =>
    resolve(resolved),
  );
  return builder as QueryBuilder;
}

describe('GroupsService', () => {
  let service: GroupsService;
  let systemMessageService: { publishToRoom: Mock };
  let tables: Record<string, QueryBuilder>;
  let fromMock: Mock;

  const ADMIN_ID = 'admin-1';
  const ROOM_ID = 'room-1';

  beforeEach(async () => {
    tables = {
      chat_rooms: createQueryBuilder({
        data: { admin_id: ADMIN_ID },
        error: null,
      }),
      chat_room_members: createQueryBuilder({ data: [], error: null }),
      chat_room_announcements: createQueryBuilder({ data: [], error: null }),
    };
    fromMock = vi.fn((table: string) => tables[table]);

    systemMessageService = {
      publishToRoom: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue({ from: fromMock }),
          },
        },
        { provide: SystemMessageService, useValue: systemMessageService },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue('http://localhost:4200') },
        },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('renameGroup', () => {
    it('renames the group and publishes a groupRenamed system message when the caller is admin', async () => {
      await service.renameGroup(ADMIN_ID, ROOM_ID, 'New Name');

      expect(tables.chat_rooms.update).toHaveBeenCalledWith({
        title: 'New Name',
      });
      expect(systemMessageService.publishToRoom).toHaveBeenCalledWith(
        ROOM_ID,
        'groupRenamed',
        {
          name: 'New Name',
        },
      );
    });

    it('throws ForbiddenException and does not publish when the caller is not admin', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { admin_id: 'someone-else' },
        error: null,
      });

      await expect(
        service.renameGroup(ADMIN_ID, ROOM_ID, 'New Name'),
      ).rejects.toThrow(ForbiddenException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });
  });

  describe('addGroupMembers', () => {
    it('inserts members and publishes a memberAdded system message with the added count', async () => {
      await service.addGroupMembers(ADMIN_ID, ROOM_ID, ['user-2', 'user-3']);

      expect(tables.chat_room_members.insert).toHaveBeenCalledWith([
        { room_id: ROOM_ID, user_id: 'user-2' },
        { room_id: ROOM_ID, user_id: 'user-3' },
      ]);
      expect(systemMessageService.publishToRoom).toHaveBeenCalledWith(
        ROOM_ID,
        'memberAdded',
        {
          count: 2,
        },
      );
    });

    it('throws ForbiddenException when the caller is not admin', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { admin_id: 'someone-else' },
        error: null,
      });

      await expect(
        service.addGroupMembers(ADMIN_ID, ROOM_ID, ['user-2']),
      ).rejects.toThrow(ForbiddenException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });
  });

  describe('removeGroupMember', () => {
    it('removes the member and publishes a memberRemoved system message', async () => {
      await service.removeGroupMember(ADMIN_ID, ROOM_ID, 'user-2');

      expect(tables.chat_room_members.match).toHaveBeenCalledWith({
        room_id: ROOM_ID,
        user_id: 'user-2',
      });
      expect(systemMessageService.publishToRoom).toHaveBeenCalledWith(
        ROOM_ID,
        'memberRemoved',
        {},
      );
    });

    it('throws ForbiddenException when the caller is not admin', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { admin_id: 'someone-else' },
        error: null,
      });

      await expect(
        service.removeGroupMember(ADMIN_ID, ROOM_ID, 'user-2'),
      ).rejects.toThrow(ForbiddenException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });
  });

  describe('joinByInviteCode', () => {
    it('joins the group and publishes a memberAdded system message for the joining user', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { id: ROOM_ID, title: 'Group', max_members: 50 },
        error: null,
      });
      tables.chat_room_members.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await service.joinByInviteCode('user-4', 'invite-code');

      expect(systemMessageService.publishToRoom).toHaveBeenCalledWith(
        ROOM_ID,
        'memberAdded',
        {
          count: 1,
        },
      );
    });

    it('throws NotFoundException for an invalid invite code', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(
        service.joinByInviteCode('user-4', 'bad-code'),
      ).rejects.toThrow(NotFoundException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user is already a member', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { id: ROOM_ID, title: 'Group', max_members: 50 },
        error: null,
      });
      tables.chat_room_members.maybeSingle.mockResolvedValue({
        data: { id: 'member-1' },
        error: null,
      });

      await expect(
        service.joinByInviteCode('user-4', 'invite-code'),
      ).rejects.toThrow(ConflictException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the group is full', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { id: ROOM_ID, title: 'Group', max_members: 1 },
        error: null,
      });
      tables.chat_room_members.then = vi.fn(
        (resolve: (v: unknown) => unknown) =>
          resolve({ count: 1, data: [], error: null }),
      );

      await expect(
        service.joinByInviteCode('user-4', 'invite-code'),
      ).rejects.toThrow(ForbiddenException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });
  });

  describe('sendAnnouncement', () => {
    it('records the announcement and publishes an announcement system message', async () => {
      await service.sendAnnouncement(ADMIN_ID, ROOM_ID, 'Meeting at 5pm');

      expect(tables.chat_room_announcements.insert).toHaveBeenCalledWith({
        room_id: ROOM_ID,
        admin_id: ADMIN_ID,
        message: 'Meeting at 5pm',
      });
      expect(systemMessageService.publishToRoom).toHaveBeenCalledWith(
        ROOM_ID,
        'announcement',
        {
          message: 'Meeting at 5pm',
        },
      );
    });

    it('throws ForbiddenException when the caller is not admin', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { admin_id: 'someone-else' },
        error: null,
      });

      await expect(
        service.sendAnnouncement(ADMIN_ID, ROOM_ID, 'Hi'),
      ).rejects.toThrow(ForbiddenException);
      expect(systemMessageService.publishToRoom).not.toHaveBeenCalled();
    });
  });

  describe('getGroupMembers', () => {
    it('returns the members for a room', async () => {
      const members = [
        {
          user_id: 'user-2',
          user: {
            id: 'user-2',
            display_name: 'Ana',
            avatar_url: null,
            native_language: 'English',
            target_languages: ['Spanish'],
            is_vip: false,
          },
        },
      ];
      tables.chat_room_members.then = vi.fn(
        (resolve: (v: unknown) => unknown) =>
          resolve({ data: members, error: null }),
      );

      const result = await service.getGroupMembers(ROOM_ID);

      expect(result).toEqual(members);
    });
  });

  describe('createGroup', () => {
    it('creates the room and adds all members including the creator', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { id: ROOM_ID, title: 'New Group', admin_id: ADMIN_ID },
        error: null,
      });

      const room = await service.createGroup(ADMIN_ID, 'New Group', ['user-2']);

      expect(tables.chat_room_members.insert).toHaveBeenCalledWith([
        { room_id: ROOM_ID, user_id: ADMIN_ID },
        { room_id: ROOM_ID, user_id: 'user-2' },
      ]);
      expect(room).toEqual({
        id: ROOM_ID,
        title: 'New Group',
        admin_id: ADMIN_ID,
      });
    });

    it('rejects when more than 50 additional members are given', async () => {
      const memberIds = Array.from({ length: 51 }, (_, i) => `user-${i}`);
      await expect(
        service.createGroup(ADMIN_ID, 'Big Group', memberIds),
      ).rejects.toThrow(
        'Group cannot exceed 51 members (50 selected + creator)',
      );
    });
  });

  describe('generateInviteCode / generateInviteLink', () => {
    it('generates and persists an invite code for the admin', async () => {
      const code = await service.generateInviteCode(ADMIN_ID, ROOM_ID);
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      expect(tables.chat_rooms.update).toHaveBeenCalledWith({
        invite_code: code,
      });
    });

    it('builds an invite link from the configured frontend URL', async () => {
      const result = await service.generateInviteLink(ADMIN_ID, ROOM_ID);
      expect(result.url).toBe(`http://localhost:4200/join/${result.code}`);
    });

    it('throws ForbiddenException when a non-admin tries to generate an invite code', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: { admin_id: 'someone-else' },
        error: null,
      });
      await expect(
        service.generateInviteCode(ADMIN_ID, ROOM_ID),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getInviteInfo', () => {
    it('returns room info for a valid, non-full invite code', async () => {
      tables.chat_rooms.maybeSingle.mockResolvedValue({
        data: { id: ROOM_ID, title: 'Group', max_members: 50 },
        error: null,
      });
      tables.chat_room_members.then = vi.fn(
        (resolve: (v: unknown) => unknown) =>
          resolve({ count: 2, data: [], error: null }),
      );

      const result = await service.getInviteInfo('invite-code');
      expect(result).toEqual({ roomId: ROOM_ID, title: 'Group' });
    });

    it('throws NotFoundException for an unknown invite code', async () => {
      tables.chat_rooms.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      await expect(service.getInviteInfo('bad-code')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the group is full', async () => {
      tables.chat_rooms.maybeSingle.mockResolvedValue({
        data: { id: ROOM_ID, title: 'Group', max_members: 1 },
        error: null,
      });
      tables.chat_room_members.then = vi.fn(
        (resolve: (v: unknown) => unknown) =>
          resolve({ count: 1, data: [], error: null }),
      );

      await expect(service.getInviteInfo('invite-code')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createAnnouncementGroup', () => {
    it('creates an announcement room and adds all members including the creator', async () => {
      tables.chat_rooms.single.mockResolvedValue({
        data: {
          id: ROOM_ID,
          title: 'Announcements',
          is_announcement: true,
          admin_id: ADMIN_ID,
        },
        error: null,
      });

      const room = await service.createAnnouncementGroup(
        ADMIN_ID,
        'Announcements',
        ['user-2'],
      );

      expect(tables.chat_room_members.insert).toHaveBeenCalledWith([
        { room_id: ROOM_ID, user_id: ADMIN_ID },
        { room_id: ROOM_ID, user_id: 'user-2' },
      ]);
      expect(room).toEqual({
        id: ROOM_ID,
        title: 'Announcements',
        is_announcement: true,
        admin_id: ADMIN_ID,
      });
    });
  });

  describe('getAnnouncements', () => {
    it('maps stored rows to the announcement DTO shape', async () => {
      tables.chat_room_announcements.then = vi.fn(
        (resolve: (v: unknown) => unknown) =>
          resolve({
            data: [
              {
                id: 'ann-1',
                message: 'Welcome!',
                created_at: '2026-08-01T00:00:00.000Z',
                admin_id: ADMIN_ID,
              },
            ],
            error: null,
          }),
      );

      const result = await service.getAnnouncements(ROOM_ID);

      expect(result).toEqual([
        {
          id: 'ann-1',
          message: 'Welcome!',
          createdAt: '2026-08-01T00:00:00.000Z',
          senderId: ADMIN_ID,
        },
      ]);
    });
  });
});
