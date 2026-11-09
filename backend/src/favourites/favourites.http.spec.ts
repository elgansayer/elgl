import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { ChatController } from '../chat/chat.controller';
import { ChatService } from '../chat/chat.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import { ConversationStarterService } from '../chat/conversation-starter.service';
import { TranslationService } from '../chat/translation.service';
import { PersonalChatEncryptionService } from '../chat/personal-chat-encryption.service';
import { ReadReceiptsService } from '../chat/read-receipts.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';

const userId = '00000000-0000-4000-8000-0000000000a1';
const otherUserId = '00000000-0000-4000-8000-0000000000a2';
const messageId = '00000000-0000-4000-8000-0000000000b1';
const favouriteId = '00000000-0000-4000-8000-0000000000c1';

/** Stands in for SupabaseAuthGuard: authenticates every request as `userId`. */
class AuthenticatedAsUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    req.user = { id: userId } as User;
    return true;
  }
}

describe('favourites routes over HTTP', () => {
  let app: INestApplication;
  let insert: ReturnType<typeof vi.fn>;
  let deleteEqUser: ReturnType<typeof vi.fn>;
  let deleteEqId: ReturnType<typeof vi.fn>;
  let favouritesSelectRange: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    insert = vi.fn().mockResolvedValue({ error: null });
    deleteEqUser = vi.fn().mockResolvedValue({ error: null });
    deleteEqId = vi.fn().mockReturnValue({ eq: deleteEqUser });
    favouritesSelectRange = vi
      .fn()
      .mockResolvedValue({ data: [], error: null });

    const favouritesTable = {
      insert,
      delete: vi.fn().mockReturnValue({ eq: deleteEqId }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ range: favouritesSelectRange }),
          }),
        }),
      }),
    };
    const supabaseService = {
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(favouritesTable),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [FavouritesController, ChatController],
      providers: [
        FavouritesService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: ChatService, useValue: {} },
        { provide: ReadReceiptsService, useValue: {} },
        { provide: CentrifugoService, useValue: {} },
        { provide: ConversationStarterService, useValue: {} },
        { provide: TranslationService, useValue: {} },
        { provide: PersonalChatEncryptionService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useClass(AuthenticatedAsUserGuard)
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror the production pipeline configured in main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe.each(['/favourites', '/chat/favourites'])('POST %s', (path) => {
    it('bookmarks the message for the authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .post(path)
        .send({ message_id: messageId, note_text: 'Useful phrase' })
        .expect(201);

      expect(response.body).toEqual({ success: true });
      expect(insert).toHaveBeenCalledWith({
        user_id: userId,
        item_type: 'message',
        item_payload: { id: messageId },
        notes: 'Useful phrase',
      });
    });

    it('rejects a client-supplied user, snapshot or item type', async () => {
      await request(app.getHttpServer())
        .post(path)
        .send({
          message_id: messageId,
          user_id: otherUserId,
          item_payload: { text_content: 'forged' },
          item_type: 'moment',
        })
        .expect(400);

      expect(insert).not.toHaveBeenCalled();
    });

    it.each([
      ['a missing message id', {}],
      ['a malformed message id', { message_id: 'not-a-uuid' }],
      [
        'a note over 500 characters',
        { message_id: messageId, note_text: 'a'.repeat(501) },
      ],
    ])('rejects %s before reaching the database', async (_label, body) => {
      await request(app.getHttpServer()).post(path).send(body).expect(400);

      expect(insert).not.toHaveBeenCalled();
    });

    it('answers a message outside the user rooms exactly like a missing message', async () => {
      insert.mockResolvedValueOnce({ error: { code: '42501' } });
      const forbidden = await request(app.getHttpServer())
        .post(path)
        .send({ message_id: messageId })
        .expect(404);

      insert.mockResolvedValueOnce({ error: { code: '23503' } });
      const missing = await request(app.getHttpServer())
        .post(path)
        .send({ message_id: messageId })
        .expect(404);

      expect(forbidden.body).toEqual(missing.body);
      expect(forbidden.body.message).toBe('Message not found');
    });

    it('is idempotent when a concurrent retry loses the unique-constraint race', async () => {
      insert.mockResolvedValueOnce({ error: { code: '23505' } });

      const response = await request(app.getHttpServer())
        .post(path)
        .send({ message_id: messageId })
        .expect(201);

      expect(response.body).toEqual({ success: true });
    });

    it('hides provider failure details behind a generic 500', async () => {
      insert.mockResolvedValueOnce({
        error: { code: 'XX000', message: 'row (secret note) failed' },
      });

      const response = await request(app.getHttpServer())
        .post(path)
        .send({ message_id: messageId, note_text: 'secret note' })
        .expect(500);

      expect(JSON.stringify(response.body)).not.toContain('secret');
    });
  });

  describe.each(['/favourites', '/chat/favourites'])(
    'DELETE %s/:id',
    (path) => {
      it('rejects a malformed favourite id before reaching the database', async () => {
        await request(app.getHttpServer())
          .delete(`${path}/not-a-uuid`)
          .expect(400);

        expect(deleteEqId).not.toHaveBeenCalled();
      });

      it('removes only the authenticated user bookmark', async () => {
        const response = await request(app.getHttpServer())
          .delete(`${path}/${favouriteId}`)
          .expect(200);

        expect(response.body).toEqual({ success: true });
        expect(deleteEqId).toHaveBeenCalledWith('id', favouriteId);
        expect(deleteEqUser).toHaveBeenCalledWith('user_id', userId);
      });

      it('can be retried after the bookmark is already gone', async () => {
        await request(app.getHttpServer())
          .delete(`${path}/${favouriteId}`)
          .expect(200);
        await request(app.getHttpServer())
          .delete(`${path}/${favouriteId}`)
          .expect(200);
      });

      it('reports a provider failure as a generic 500', async () => {
        deleteEqUser.mockResolvedValueOnce({
          error: { code: 'XX000', message: 'secret provider detail' },
        });

        const response = await request(app.getHttpServer())
          .delete(`${path}/${favouriteId}`)
          .expect(500);

        expect(JSON.stringify(response.body)).not.toContain('secret');
      });
    },
  );

  describe('GET /favourites/messages', () => {
    it('applies the default page bounds', async () => {
      await request(app.getHttpServer())
        .get('/favourites/messages')
        .expect(200);

      // Default limit 50 over a zero offset; one extra row is requested.
      expect(favouritesSelectRange).toHaveBeenCalledWith(0, 50);
    });

    it.each([
      ['a limit above 100', 'limit=101'],
      ['a limit below 1', 'limit=0'],
      ['a negative offset', 'offset=-1'],
      ['an offset above 10000', 'offset=10001'],
      ['a non-numeric limit', 'limit=many'],
    ])('rejects %s', async (_label, query) => {
      await request(app.getHttpServer())
        .get(`/favourites/messages?${query}`)
        .expect(400);

      expect(favouritesSelectRange).not.toHaveBeenCalled();
    });
  });

  describe('GET /favourites/user/:userId', () => {
    it('refuses to read another account', async () => {
      await request(app.getHttpServer())
        .get(`/favourites/user/${otherUserId}`)
        .expect(403);

      expect(favouritesSelectRange).not.toHaveBeenCalled();
    });

    it('allows the account owner', async () => {
      await request(app.getHttpServer())
        .get(`/favourites/user/${userId}`)
        .expect(200);
    });
  });
});
