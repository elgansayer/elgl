import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Mock } from 'vitest';
import { GroupsService } from './groups.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { GroupChatService } from '../chat/group-chat.service';
import { InterestsService } from '../interests/interests.service';

describe('GroupsService shared vocabulary', () => {
  let service: GroupsService;
  let from: Mock;

  const group = { id: 'group-1', owner_id: 'owner-1' };
  const entry = {
    id: 'entry-1',
    group_id: 'group-1',
    created_by: 'member-1',
    term: 'bonjour',
    translation: 'hello',
    language: 'fr',
    created_at: '2026-11-14T00:00:00.000Z',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: SupabaseService, useValue: { getClient: vi.fn() } },
        { provide: CentrifugoService, useValue: { publish: vi.fn() } },
        { provide: InterestsService, useValue: { findById: vi.fn() } },
        { provide: GroupChatService, useValue: { create: vi.fn() } },
      ],
    }).compile();

    service = moduleRef.get(GroupsService);
    const supabase = moduleRef.get(SupabaseService)
      .getClient as unknown as Mock;
    from = vi.fn();
    supabase.mockReturnValue({ from });
  });

  function builder(overrides: Record<string, Mock>): Record<string, Mock> {
    const chain: Record<string, Mock> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      returns: vi.fn().mockResolvedValue({ data: null, error: null }),
      ...overrides,
    };
    return chain;
  }

  it('lists the bank for a group member resolved from the chat room', async () => {
    const groups = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: group, error: null }),
    });
    const members = builder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { user_id: 'member-1' }, error: null }),
    });
    const vocabulary = builder({
      returns: vi.fn().mockResolvedValue({ data: [entry], error: null }),
    });
    from.mockImplementation((table: string) => {
      if (table === 'groups') return groups;
      if (table === 'group_members') return members;
      if (table === 'group_vocabulary') return vocabulary;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(
      service.getGroupVocabulary('member-1', 'room-1'),
    ).resolves.toEqual([entry]);
  });

  it('denies non-members before reading the bank', async () => {
    const groups = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: group, error: null }),
    });
    const members = builder();
    from.mockImplementation((table: string) =>
      table === 'groups' ? groups : members,
    );

    await expect(
      service.getGroupVocabulary('outsider-1', 'room-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(from).not.toHaveBeenCalledWith('group_vocabulary');
  });

  it('reports a duplicate term as a conflict', async () => {
    const groups = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: group, error: null }),
    });
    const members = builder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { user_id: 'member-1' }, error: null }),
    });
    const vocabulary = builder({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      }),
    });
    from.mockImplementation((table: string) => {
      if (table === 'groups') return groups;
      if (table === 'group_members') return members;
      return vocabulary;
    });

    await expect(
      service.addGroupVocabulary('member-1', 'room-1', {
        term: ' bonjour ',
        translation: ' hello ',
        language: 'fr',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(vocabulary.insert).toHaveBeenCalledWith({
      group_id: 'group-1',
      created_by: 'member-1',
      term: 'bonjour',
      translation: 'hello',
      language: 'fr',
    });
  });

  it('allows the creator or the group owner to delete an entry', async () => {
    const groups = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: group, error: null }),
    });
    const members = builder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { user_id: 'member-1' }, error: null }),
    });
    const vocabulary = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: entry, error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
    from.mockImplementation((table: string) => {
      if (table === 'groups') return groups;
      if (table === 'group_members') return members;
      return vocabulary;
    });

    await expect(
      service.deleteGroupVocabulary('member-1', 'room-1', 'entry-1'),
    ).resolves.toBeUndefined();

    await expect(
      service.deleteGroupVocabulary('owner-1', 'room-1', 'entry-1'),
    ).resolves.toBeUndefined();
  });

  it('forbids deleting another member’s entry as a non-owner', async () => {
    const groups = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: group, error: null }),
    });
    const members = builder({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { user_id: 'member-2' }, error: null }),
    });
    const vocabulary = builder({
      maybeSingle: vi.fn().mockResolvedValue({ data: entry, error: null }),
    });
    from.mockImplementation((table: string) => {
      if (table === 'groups') return groups;
      if (table === 'group_members') return members;
      return vocabulary;
    });

    await expect(
      service.deleteGroupVocabulary('member-2', 'room-1', 'entry-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(vocabulary.delete).not.toHaveBeenCalled();
  });
});
