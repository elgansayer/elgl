import { Test, type TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import type { Mock } from 'vitest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatSearchController } from './chat-search.controller';
import { ChatService } from './chat.service';
import type { SearchMessagesQueryDto } from './dto/search-messages-query.dto';

function mockUser(): User {
  return { id: 'user-1' } as unknown as User;
}

describe('ChatSearchController', () => {
  let controller: ChatSearchController;
  let searchAllMessages: Mock;

  beforeEach(async () => {
    searchAllMessages = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatSearchController],
      providers: [
        {
          provide: ChatService,
          useValue: { searchAllMessages },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ChatSearchController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not search without an authenticated user', async () => {
    const query = { term: 'hello', limit: 50 } as SearchMessagesQueryDto;

    await expect(controller.searchMessages(null, query)).resolves.toEqual([]);
    expect(searchAllMessages).not.toHaveBeenCalled();
  });

  it('delegates a global search to the membership-scoped search service', async () => {
    const messages = [{ id: 'message-1' }];
    searchAllMessages.mockResolvedValue(messages);
    const query = { term: 'hello', limit: 25 } as SearchMessagesQueryDto;

    await expect(controller.searchMessages(mockUser(), query)).resolves.toEqual(
      messages,
    );
    expect(searchAllMessages).toHaveBeenCalledWith(
      'user-1',
      'hello',
      25,
      undefined,
    );
  });

  it('passes a room id for room-scoped search', async () => {
    searchAllMessages.mockResolvedValue([]);
    const query = {
      term: 'bonjour',
      roomId: 'room-1',
      limit: 50,
    } as SearchMessagesQueryDto;

    await controller.searchMessages(mockUser(), query);

    expect(searchAllMessages).toHaveBeenCalledWith(
      'user-1',
      'bonjour',
      50,
      'room-1',
    );
  });
});
