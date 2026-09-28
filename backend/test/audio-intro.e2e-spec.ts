import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AudioIntroController } from '../src/audio-intro/audio-intro.controller';
import { AudioIntroService } from '../src/audio-intro/audio-intro.service';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Audio intro ownership (HTTP)', () => {
  let app: INestApplication;
  const updateAudioIntro = vi.fn();
  const getUser = vi.fn();
  const audioUrl = 'https://example.com/intro.mp3';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AudioIntroController],
      providers: [
        { provide: AudioIntroService, useValue: { updateAudioIntro } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth: { getUser } }) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
    updateAudioIntro.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows the owner verified by the real authentication guard', async () => {
    await request(app.getHttpServer())
      .patch('/audio-intro/owner')
      .set('Authorization', 'Bearer valid-token')
      .send({ audio_url: audioUrl })
      .expect(200);

    expect(getUser).toHaveBeenCalledWith('valid-token');
    expect(updateAudioIntro).toHaveBeenCalledExactlyOnceWith('owner', audioUrl);
  });

  it('rejects another target even when the body claims that identity', async () => {
    await request(app.getHttpServer())
      .patch('/audio-intro/victim')
      .set('Authorization', 'Bearer valid-token')
      .send({ audio_url: audioUrl, user: { id: 'victim' }, userId: 'victim' })
      .expect(403);

    expect(updateAudioIntro).not.toHaveBeenCalled();
  });

  it('rejects missing authentication before calling the service', async () => {
    await request(app.getHttpServer())
      .patch('/audio-intro/owner')
      .send({ audio_url: audioUrl })
      .expect(401);

    expect(getUser).not.toHaveBeenCalled();
    expect(updateAudioIntro).not.toHaveBeenCalled();
  });

  it('rejects a token that does not resolve to an authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await request(app.getHttpServer())
      .patch('/audio-intro/owner')
      .set('Authorization', 'Bearer invalid-token')
      .send({ audio_url: audioUrl })
      .expect(401);

    expect(updateAudioIntro).not.toHaveBeenCalled();
  });
});
