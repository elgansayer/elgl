import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { ChatSettingsController } from '../src/chat/chat-settings.controller';
import { ChatSettingsService } from '../src/chat/chat-settings.service';

/**
 * The Appearance page saves the chat text size through PUT /chat/settings. The
 * production pipe rejects unknown properties, so this contract is exercised over
 * HTTP with the same pipe options as src/main.ts rather than only as a DTO.
 */
describe('Chat settings E2E', () => {
  let app: INestApplication;
  const getSettings = vi.fn();
  const updateSettings = vi.fn();

  beforeEach(async () => {
    getSettings.mockReset();
    updateSettings.mockReset();
    getSettings.mockResolvedValue({ textSize: 'medium' });
    updateSettings.mockImplementation(
      (_userId: string, settings: Record<string, unknown>) =>
        Promise.resolve({ ...settings }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ChatSettingsController],
      providers: [
        {
          provide: ChatSettingsService,
          useValue: { getSettings, updateSettings },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: vi.fn((context) => {
          const request = context.switchToHttp().getRequest();
          if (!request.headers.authorization) {
            throw new UnauthorizedException('Missing authentication token');
          }
          request.user = { sub: 'user-1' };
          return true;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    // Same options as src/main.ts.
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
  });

  const save = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .put('/chat/settings')
      .set('Authorization', 'Bearer token')
      .send(body);

  it.each(['small', 'medium', 'large'])(
    'accepts the %s chat text size for the authenticated user only',
    async (textSize) => {
      const response = await save({ textSize }).expect(200);

      expect(response.body).toEqual({ textSize });
      expect(updateSettings).toHaveBeenCalledExactlyOnceWith('user-1', {
        textSize,
      });
    },
  );

  it('saves the chat text size together with another chat setting', async () => {
    await save({ textSize: 'large', readReceipts: true }).expect(200);

    expect(updateSettings).toHaveBeenCalledWith('user-1', {
      textSize: 'large',
      readReceipts: true,
    });
  });

  it.each([
    ['an unsupported size', { textSize: 'huge' }],
    ['a differently cased size', { textSize: 'Large' }],
    ['a numeric size', { textSize: 18 }],
    ['an unknown preference', { fontSize: 'large' }],
    ['a caller-supplied user identifier', { textSize: 'large', userId: 'x' }],
  ])('rejects %s without saving anything', async (_label, body) => {
    await save(body).expect(400);

    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('returns the saved chat text size when settings are read', async () => {
    getSettings.mockResolvedValue({ textSize: 'large', readReceipts: true });

    const response = await request(app.getHttpServer())
      .get('/chat/settings')
      .set('Authorization', 'Bearer token')
      .expect(200);

    expect(response.body).toEqual({ textSize: 'large', readReceipts: true });
    expect(getSettings).toHaveBeenCalledWith('user-1');
  });

  it('requires authentication to read or write settings', async () => {
    await request(app.getHttpServer()).get('/chat/settings').expect(401);
    await request(app.getHttpServer())
      .put('/chat/settings')
      .send({ textSize: 'large' })
      .expect(401);

    expect(getSettings).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('reports a storage outage as a sanitised 503', async () => {
    updateSettings.mockRejectedValue(
      new ServiceUnavailableException('Chat settings could not be updated'),
    );

    const response = await save({ textSize: 'large' }).expect(503);

    expect(JSON.stringify(response.body)).not.toContain('user-1');
  });
});
