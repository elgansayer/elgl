import type { Mock } from 'vitest';
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
          useValue: { getClient: vi.fn() },
        },
        {
          provide: CentrifugoService,
          useValue: { publish: vi.fn() },
        },
        {
          provide: InterestsService,
          useValue: { findById: vi.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(GroupsService);
    supabaseService = moduleRef.get(SupabaseService);
    centrifugoService = moduleRef.get(CentrifugoService);
    interestsService = moduleRef.get(InterestsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('isAdmin returns true when the caller owns the group', async () => {
    const ownerRow = { owner_id: 'user-123' };
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: ownerRow, error: null }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    const result = await service.isAdmin('user-123', 'group-1');
    expect(result).toBe(true);
  });

  it('isAdmin returns false when the group does not exist', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'x' } }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    const result = await service.isAdmin('user-123', 'missing');
    expect(result).toBe(false);
  });

  it('addMember adds a member when the group is not full', async () => {
    const ownerRow = { owner_id: 'admin-1' };
    const groupRow = { max_members: 10 };
    let groupsCalls = 0;
    const groupsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        groupsCalls += 1;
        if (groupsCalls === 1) {
          return { data: ownerRow, error: null };
        }
        return { data: groupRow, error: null };
      }),
    };
    // For users table: member exists
    const usersBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'member-9' }, error: null }),
    };
    // For group_members: first call = no membership, second = count
    let memberCalls = 0;
    const memberNoExistingBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const memberCountBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const memberInsertBuilder = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const mockFrom = vi.fn((table: string) => {
      if (table === 'groups') return groupsBuilder;
      if (table === 'users') return usersBuilder;
      if (table === 'group_members') {
        memberCalls += 1;
        if (memberCalls === 1) return memberNoExistingBuilder;
        if (memberCalls === 2) return memberCountBuilder;
        return memberInsertBuilder;
      }
      return memberInsertBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(
      service.addMember('group-1', 'member-9', 'admin-1'),
    ).resolves.not.toThrow();
  });

  it('addMember throws ForbiddenException when the group is full', async () => {
    const ownerRow = { owner_id: 'admin-1' };
    const groupRow = { max_members: 2 };
    let groupsCalls = 0;
    const groupsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        groupsCalls += 1;
        if (groupsCalls === 1) {
          return { data: ownerRow, error: null };
        }
        return { data: groupRow, error: null };
      }),
    };
    const usersBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'member-9' }, error: null }),
    };
    const memberNoExistingBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    let memberCalls = 0;
    const memberCountBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const mockFrom = vi.fn((table: string) => {
      if (table === 'groups') return groupsBuilder;
      if (table === 'users') return usersBuilder;
      if (table === 'group_members') {
        memberCalls += 1;
        if (memberCalls === 1) return memberNoExistingBuilder;
        return memberCountBuilder;
      }
      return memberCountBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(
      service.addMember('group-1', 'member-9', 'admin-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('removeMember deletes the member row', async () => {
    const ownerRow = { owner_id: 'admin-1' };
    const groupData = { owner_id: 'admin-1' };
    let groupsCalls = 0;
    const groupsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        groupsCalls += 1;
        if (groupsCalls === 1) {
          return { data: ownerRow, error: null };
        }
        return { data: groupData, error: null };
      }),
    };
    const memberBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: 'm1' }, error: null }),
    };
    const deleteBuilder = {
      delete: vi.fn().mockReturnThis(),
      match: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    let memberCalls = 0;
    const mockFrom = vi.fn((table: string) => {
      if (table === 'groups') return groupsBuilder;
      if (table === 'group_members') {
        memberCalls += 1;
        if (memberCalls === 1) return memberBuilder;
        return deleteBuilder;
      }
      return deleteBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(
      service.removeMember('group-1', 'member-9', 'admin-1'),
    ).resolves.not.toThrow();
  });

  it('createGroup enforces size limits and adds the owner as a member', async () => {
    const interestRow = { id: 'inter-1', name: 'Football' };
    (interestsService.findById as unknown as Mock).mockResolvedValue(
      interestRow,
    );

    const insertGroupBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
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
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const mockFrom = vi.fn((table: string) => {
      return table === 'groups' ? insertGroupBuilder : insertMemberBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
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
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    const result = await service.getGroupMembers('group-1');
    expect(result).toEqual(rows);
  });

  it('sendAnnouncement persists and publishes the announcement', async () => {
    const insertBuilder = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(insertBuilder),
    });
    (centrifugoService.publish as unknown as Mock).mockResolvedValue(undefined);

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
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
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
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: row, error: null }),
      returns: vi.fn().mockReturnThis(),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(builder),
    });

    const result = await service.getGroupInfo('group-1');
    expect(result.interest).toEqual({ name: 'Football' });
  });

  it('setCommunityId updates the community id', async () => {
    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(updateBuilder),
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
      select: vi.fn().mockReturnThis(),
      returns: vi.fn().mockResolvedValue({ data: groups, error: null }),
    };
    const membershipsBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ group_id: 'g1' }],
        error: null,
      }),
    };

    const countMemberBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    };

    let groupMemberCalls = 0;
    const mockFrom = vi.fn((table: string) => {
      if (table === 'groups') return groupsBuilder;
      if (table === 'group_members') {
        groupMemberCalls += 1;
        if (groupMemberCalls === 1) {
          return membershipsBuilder;
        }
        return countMemberBuilder;
      }
      return countMemberBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    const result = await service.getDiscoverableGroups('user-1');
    expect(result[0].member_count).toBe(2);
    expect(result[0].is_member).toBe(true);
  });

  it('joinGroup returns false when the user is already a member', async () => {
    const groupRow = { max_members: 5 };
    const groupBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: groupRow, error: null }),
    };
    const existingBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'memberrow' },
        error: null,
      }),
    };
    const mockFrom = vi.fn((table: string) => {
      if (table === 'groups') return groupBuilder;
      if (table === 'group_members') return existingBuilder;
      return existingBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    const result = await service.joinGroup('group-1', 'user-1');
    expect(result).toEqual({ success: false });
  });

  it('joinGroup throws ForbiddenException when the group is full', async () => {
    const groupRow = { max_members: 2 };
    const groupBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: groupRow, error: null }),
    };
    let groupMemberCalls = 0;
    const noExistingBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const countBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    };
    const mockFrom = vi.fn((table: string) => {
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
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(service.joinGroup('group-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deleteGroupResource throws ForbiddenException for non-admin', async () => {
    const adminBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { owner_id: 'other-owner' },
        error: null,
      }),
    };
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue(adminBuilder),
    });

    await expect(
      service.deleteGroupResource('group-1', 'res-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deleteGroupResource deletes resource when the caller is admin', async () => {
    const adminBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { owner_id: 'admin-1' },
        error: null,
      }),
    };
    const deleteBuilder = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    const mockFrom = vi.fn((table: string) => {
      if (table === 'groups') return adminBuilder;
      if (table === 'group_resources') return deleteBuilder;
      return deleteBuilder;
    });
    (supabaseService.getClient as unknown as Mock).mockReturnValue({
      from: mockFrom,
    });

    await expect(
      service.deleteGroupResource('group-1', 'res-1', 'admin-1'),
    ).resolves.not.toThrow();
  });
});
