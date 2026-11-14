import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeveloperBotsService } from './developer-bots.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CustomEducationalBotRow } from './interfaces/custom-bot.interface';

const bot = {
  id: '11111111-1111-4111-8111-111111111111',
  owner_id: 'user-1',
  display_name: 'Chef Ana',
  persona: 'A cheerful Spanish chef',
  target_language: 'es',
  tone: 'playful',
  greeting: 'Hola',
  is_enabled: true,
  created_at: '2026-11-14T00:00:00.000Z',
  updated_at: '2026-11-14T00:00:00.000Z',
} as CustomEducationalBotRow;

function chain(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
  ]) {
    query[method] = vi.fn(() => query);
  }
  query['single'] = vi.fn(() => Promise.resolve(result));
  query['then'] = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(result).then(resolve);
  return query;
}

describe('DeveloperBotsService', () => {
  let service: DeveloperBotsService;
  let from: ReturnType<typeof vi.fn>;
  let query: ReturnType<typeof chain>;

  const setup = (result: unknown) => {
    query = chain(result);
    from = vi.fn(() => query);
    service = new DeveloperBotsService({
      getClient: () => ({ from }),
    } as unknown as SupabaseService);
  };

  it('lists only the caller bots', async () => {
    setup({ data: [bot], error: null });

    await expect(service.listBots('user-1')).resolves.toEqual([bot]);

    expect(from).toHaveBeenCalledWith('custom_educational_bots');
    expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');
    expect(query.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
  });

  it('surfaces listing failures', async () => {
    setup({ data: null, error: { message: 'down' } });

    await expect(service.listBots('user-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('creates a bot owned by the caller', async () => {
    setup({ data: bot, error: null });

    const result = await service.createBot('user-1', {
      display_name: 'Chef Ana',
      persona: 'A cheerful Spanish chef',
      target_language: 'es',
      tone: 'playful',
      greeting: 'Hola',
    });

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: 'user-1',
        display_name: 'Chef Ana',
        is_enabled: true,
      }),
    );
    expect(result).toEqual(bot);
  });

  it('scopes updates to the owner and reports missing bots', async () => {
    setup({ data: bot, error: null });

    await service.updateBot(bot.id, 'user-1', { display_name: 'Chef Ana 2' });

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Chef Ana 2' }),
    );
    expect(query.eq).toHaveBeenCalledWith('id', bot.id);
    expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');

    setup({ data: null, error: null });
    await expect(
      service.updateBot(bot.id, 'other-user', { display_name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes only a bot the caller owns', async () => {
    setup({ data: [{ id: bot.id }], error: null });

    await expect(service.deleteBot(bot.id, 'user-1')).resolves.toBeUndefined();
    expect(query.eq).toHaveBeenCalledWith('owner_id', 'user-1');

    setup({ data: [], error: null });
    await expect(
      service.deleteBot(bot.id, 'other-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an enabled bot for a conversation', async () => {
    setup({ data: bot, error: null });

    await expect(service.getEnabledBot(bot.id, 'user-1')).resolves.toEqual(bot);
  });

  it('refuses a disabled or foreign bot', async () => {
    setup({ data: { ...bot, is_enabled: false }, error: null });
    await expect(
      service.getEnabledBot(bot.id, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    setup({ data: null, error: { message: 'not found' } });
    await expect(
      service.getEnabledBot(bot.id, 'other-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
