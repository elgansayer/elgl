import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { InterestsService } from '../interests/interests.service';

describe('GroupsService', () => {
  let service: GroupsService;
  let supabaseService: SupabaseService;
  let centrifugoService: CentrifugoService;
  let interestsService: InterestsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GroupsService,
        {
          provide: SupabaseService,
          useValue: { getClient: jest.fn() },
        },
        {
          provide: CentrifugoService,
          useValue: { publish: jest.fn() },
        },
        {
          provide: InterestsService,
          useValue: { findById: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(GroupsService);
    supabaseService = moduleRef.get(SupabaseService);
    centrifugoService = moduleRef.get(CentrifugoService);
    interestsService = moduleRef.get(InterestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('isAdmin returns true when the caller owns the group', async () => {
    const ownerRow = { owner_id: 'user-123' };
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: ownerRow, error: null }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(builder),
    });

    const result = await service.isAdmin('user-123', 'group-1');
    expect(result).toBe(true);
  });

  it('isAdmin returns false when the group does not exist', async () => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'x' } }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(builder),
    });

    const result = await service.isAdmin('user-123', 'missing');
    expect(result).toBe(false);
  });

  it('addMember adds a member when the group is not full', async () => {
    const groupRow = { max_members: 10 };
    const groupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: groupRow, error: null }),
    };
    let groupMemberCalls = 0;
    const countBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const insertBuilder = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const mockFrom = jest.fn((table: string) => {
      if (table === 'groups') return groupBuilder;
      if (table === 'group_members') {
        groupMemberCalls += 1;
        if (groupMemberCalls === 1) {
          return countBuilder;
        }
        return insertBuilder;
      }
      return insertBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(
      service.addMember('group-1', 'member-9'),
    ).resolves.not.toThrow();
    expect(mockFrom).toHaveBeenCalledWith('group_members');
  });

  it('addMember throws ForbiddenException when the group is full', async () => {
    const groupRow = { max_members: 2 };
    const groupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: groupRow, error: null }),
    };
    const countBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const mockFrom = jest.fn((table: string) => {
      return table === 'groups' ? groupBuilder : countBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(service.addMember('group-1', 'member-9')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('removeMember deletes the member row', async () => {
    const deleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      match: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(deleteBuilder),
    });

    await expect(
      service.removeMember('group-1', 'member-9'),
    ).resolves.not.toThrow();
  });

  it('createGroup enforces size limits and adds the owner as a member', async () => {
    const interestRow = { id: 'inter-1', name: 'Football' };
    (interestsService.findById as unknown as jest.Mock).mockResolvedValue(
      interestRow,
    );

    const insertGroupBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'group-1',
          name: 'Test Group',
          owner_id: 'owner-1',
          community_id: null,
          interest_id: 'inter-1',
          max_members: 5,
          created_at: '2026-01-01',
        },
        error: null,
      }),
    };
    const insertMemberBuilder = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const mockFrom = jest.fn((table: string) => {
      return table === 'groups' ? insertGroupBuilder : insertMemberBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    const group = await service.createGroup(
      'owner-1',
      'Test Group',
      undefined,
      'inter-1',
      100,
    );

    expect(group.max_members).toBe(5);
    expect(mockFrom).toHaveBeenCalledWith('groups');
    expect(insertMemberBuilder.insert).toHaveBeenCalledWith({
      group_id: 'group-1',
      user_id: 'owner-1',
    });
  });

  it('getGroupMembers maps the returned rows', async () => {
    const rows = [
      {
        user_id: 'u1',
        user: { id: 'u1', display_name: 'Alice', avatar_url: null },
      },
    ];
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      returns: jest.fn().mockResolvedValue({ data: rows, error: null }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(builder),
    });

    const result = await service.getGroupMembers('group-1');
    expect(result).toEqual(rows);
  });

  it('sendAnnouncement persists and publishes the announcement', async () => {
    const insertBuilder = {
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(insertBuilder),
    });
    (centrifugoService.publish as unknown as jest.Mock).mockResolvedValue(
      undefined,
    );

    const result = await service.sendAnnouncement(
      'group-1',
      'Hello everyone',
      'sender-1',
    );

    expect(result).toEqual({ success: true });
    expect(centrifugoService.publish).toHaveBeenCalledWith(
      'group_announcements:group-1',
      {
        type: 'announcement',
        message: 'Hello everyone',
        senderId: 'sender-1',
      },
    );
  });

  it('getAnnouncements returns the announcements with mapped properties', async () => {
    const rows = [
      {
        id: 'a1',
        sender_id: 'sender-1',
        message: 'Hello',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: rows, error: null }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(builder),
    });

    const result = await service.getAnnouncements('group-1');
    expect(result).toEqual([
      {
        id: 'a1',
        message: 'Hello',
        senderId: 'sender-1',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });

  it('getGroupInfo returns a single interest object', async () => {
    const row = {
      id: 'group-1',
      name: 'Test',
      owner_id: 'owner-1',
      community_id: null,
      interest_id: 'int-1',
      max_members: 5,
      created_at: '2026-01-01',
      interest: [{ name: 'Football' }],
    };
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: row, error: null }),
      returns: jest.fn().mockReturnThis(),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(builder),
    });

    const result = await service.getGroupInfo('group-1');
    expect(result.interest).toEqual({ name: 'Football' });
  });

  it('setCommunityId updates the community id', async () => {
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(updateBuilder),
    });

    await expect(
      service.setCommunityId('group-1', 'community-1'),
    ).resolves.not.toThrow();
  });

  it('getDiscoverableGroups enriches rows with member_count and is_member', async () => {
    const groups = [
      {
        id: 'g1',
        name: 'G1',
        owner_id: 'owner-1',
        community_id: null,
        interest_id: null,
        max_members: 5,
        created_at: '2026-01-01',
      },
    ];
    const groupsBuilder = {
      select: jest.fn().mockReturnThis(),
      returns: jest.fn().mockResolvedValue({ data: groups, error: null }),
    };
    let groupMemberCalls = 0;
    const countMemberBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const singleMembershipBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { user_id: 'user-1' },
        error: null,
      }),
    };
    const mockFrom = jest.fn((table: string) => {
      if (table === 'groups') return groupsBuilder;
      if (table === 'group_members') {
        groupMemberCalls += 1;
        if (groupMemberCalls === 1) {
          return countMemberBuilder;
        }
        return singleMembershipBuilder;
      }
      return countMemberBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    const result = await service.getDiscoverableGroups('user-1');
    expect(result[0].member_count).toBe(2);
    expect(result[0].is_member).toBe(true);
  });

  it('joinGroup returns false when the user is already a member', async () => {
    const groupRow = { max_members: 5 };
    const groupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: groupRow, error: null }),
    };
    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'memberrow' },
        error: null,
      }),
    };
    const mockFrom = jest.fn((table: string) => {
      if (table === 'groups') return groupBuilder;
      if (table === 'group_members') return existingBuilder;
      return existingBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    const result = await service.joinGroup('group-1', 'user-1');
    expect(result).toEqual({ success: false });
  });

  it('joinGroup throws ForbiddenException when the group is full', async () => {
    const groupRow = { max_members: 2 };
    const groupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: groupRow, error: null }),
    };
    let groupMemberCalls = 0;
    const noExistingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };
    const countBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const mockFrom = jest.fn((table: string) => {
      if (table === 'groups') return groupBuilder;
      if (table === 'group_members') {
        groupMemberCalls += 1;
        if (groupMemberCalls === 1) {
          return noExistingBuilder;
        }
        return countBuilder;
      }
      return countBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(service.joinGroup('group-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deleteGroupResource throws ForbiddenException for non-admin', async () => {
    const adminBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { owner_id: 'other-owner' },
        error: null,
      }),
    };
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue(adminBuilder),
    });

    await expect(
      service.deleteGroupResource('group-1', 'res-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deleteGroupResource deletes resource when the caller is admin', async () => {
    const adminBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { owner_id: 'admin-1' },
        error: null,
      }),
    };
    const deleteBuilder = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    const mockFrom = jest.fn((table: string) => {
      if (table === 'groups') return adminBuilder;
      if (table === 'group_resources') return deleteBuilder;
      return deleteBuilder;
    });
    (supabaseService.getClient as unknown as jest.Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(
      service.deleteGroupResource('group-1', 'res-1', 'admin-1'),
    ).resolves.not.toThrow();
  });
});
