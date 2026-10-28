import type { Mock } from 'vitest';
// ChatService transitively imports browser-oriented dependencies through link-preview.
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: { createElement: vi.fn(), createDocumentFragment: vi.fn() },
      },
    };
  }),
}));
vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: vi.fn((value: string) => value),
    setConfig: vi.fn(),
  })),
}));

import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatGroupsController } from './chat-groups.controller';
import { ChatService } from './chat.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto, RenameGroupDto } from './dto/group.dto';

describe('ChatGroupsController', () => {
  let controller: ChatGroupsController;
  let chatService: {
    getGroupMembers: Mock;
    createGroup: Mock;
    renameGroup: Mock;
    addGroupMembers: Mock;
    removeGroupMember: Mock;
  };

  const user = { id: 'admin-1' } as unknown as User;

  beforeEach(async () => {
    chatService = {
      getGroupMembers: vi.fn(),
      createGroup: vi.fn(),
      renameGroup: vi.fn().mockResolvedValue(undefined),
      addGroupMembers: vi.fn().mockResolvedValue(undefined),
      removeGroupMember: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatGroupsController],
      providers: [{ provide: ChatService, useValue: chatService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ChatGroupsController);
  });

  it('is protected by Supabase authentication under the chat/groups prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ChatGroupsController)).toBe(
      'chat/groups',
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatGroupsController),
    ).toContain(SupabaseAuthGuard);
  });

  it.each([
    ['getMembers', ':roomId/members', RequestMethod.GET],
    ['createGroup', '/', RequestMethod.POST],
    ['renameGroup', ':roomId/rename', RequestMethod.PATCH],
    ['addMembers', ':roomId/members', RequestMethod.POST],
    ['removeMember', ':roomId/members/:memberId', RequestMethod.DELETE],
  ] as const)(
    'maps %s to the route the Angular ChatService already calls',
    (handlerName, path, method) => {
      const handler = ChatGroupsController.prototype[handlerName];

      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    },
  );

  describe('getMembers', () => {
    it('returns nothing without an authenticated user', async () => {
      await expect(controller.getMembers('room-1', null)).resolves.toEqual([]);
      expect(chatService.getGroupMembers).not.toHaveBeenCalled();
    });

    it('lists participants for the authenticated caller so membership can be enforced', async () => {
      const members = [{ user_id: 'u1', user: null }];
      chatService.getGroupMembers.mockResolvedValue(members);

      await expect(controller.getMembers('room-1', user)).resolves.toBe(
        members,
      );
      expect(chatService.getGroupMembers).toHaveBeenCalledWith(
        'room-1',
        'admin-1',
      );
    });
  });

  describe('createGroup', () => {
    it('creates nothing without an authenticated user', async () => {
      const dto = Object.assign(new CreateGroupDto(), {
        name: 'Spanish Club',
        memberIds: ['u2'],
      });

      await expect(controller.createGroup(null, dto)).resolves.toBeNull();
      expect(chatService.createGroup).not.toHaveBeenCalled();
    });

    it('creates the group with the authenticated user as creator, never a client-supplied id', async () => {
      const room = { id: 'room-1', title: 'Spanish Club', admin_id: 'admin-1' };
      chatService.createGroup.mockResolvedValue(room);
      const dto = Object.assign(new CreateGroupDto(), {
        name: 'Spanish Club',
        memberIds: ['u2', 'u3'],
      });

      await expect(controller.createGroup(user, dto)).resolves.toBe(room);
      expect(chatService.createGroup).toHaveBeenCalledWith(
        'admin-1',
        'Spanish Club',
        ['u2', 'u3'],
      );
    });
  });

  describe('administration', () => {
    it('renames a group as the authenticated user, never a client-supplied id', async () => {
      const dto = Object.assign(new RenameGroupDto(), { name: 'Spanish Club' });

      await expect(
        controller.renameGroup(user, 'room-1', dto),
      ).resolves.toEqual({
        success: true,
      });
      expect(chatService.renameGroup).toHaveBeenCalledWith(
        'admin-1',
        'room-1',
        'Spanish Club',
      );
    });

    it('adds members as the authenticated user', async () => {
      const dto = Object.assign(new AddMemberDto(), {
        memberIds: ['u2', 'u3'],
      });

      await expect(controller.addMembers(user, 'room-1', dto)).resolves.toEqual(
        {
          success: true,
        },
      );
      expect(chatService.addGroupMembers).toHaveBeenCalledWith(
        'admin-1',
        'room-1',
        ['u2', 'u3'],
      );
    });

    it('removes a member as the authenticated user', async () => {
      await expect(
        controller.removeMember(user, 'room-1', 'u2'),
      ).resolves.toEqual({ success: true });
      expect(chatService.removeGroupMember).toHaveBeenCalledWith(
        'admin-1',
        'room-1',
        'u2',
      );
    });

    it.each([
      [
        'renameGroup',
        (): Promise<unknown> =>
          controller.renameGroup(null, 'room-1', new RenameGroupDto()),
      ],
      [
        'addMembers',
        (): Promise<unknown> =>
          controller.addMembers(null, 'room-1', new AddMemberDto()),
      ],
      [
        'removeMember',
        (): Promise<unknown> => controller.removeMember(null, 'room-1', 'u2'),
      ],
    ])('%s does nothing without an authenticated user', async (_name, call) => {
      await expect(call()).resolves.toBeNull();
      expect(chatService.renameGroup).not.toHaveBeenCalled();
      expect(chatService.addGroupMembers).not.toHaveBeenCalled();
      expect(chatService.removeGroupMember).not.toHaveBeenCalled();
    });
  });
});
