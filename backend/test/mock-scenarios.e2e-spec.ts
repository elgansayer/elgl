import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MockScenariosModule } from '../src/mock/mock-scenarios.module';

describe('Mock scenario manifests API', () => {
  let app: INestApplication;
  const originalMode = process.env.MOCK_BACKEND_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalScenarios = process.env.MOCK_BACKEND_SCENARIOS;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';
    delete process.env.MOCK_BACKEND_SCENARIOS;

    const moduleRef = await Test.createTestingModule({
      imports: [MockScenariosModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (originalMode === undefined) delete process.env.MOCK_BACKEND_MODE;
    else process.env.MOCK_BACKEND_MODE = originalMode;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalScenarios === undefined)
      delete process.env.MOCK_BACKEND_SCENARIOS;
    else process.env.MOCK_BACKEND_SCENARIOS = originalScenarios;
  });

  it('lists, selects, reads and resets composable scenario packs', async () => {
    const listResponse = await request(app.getHttpServer())
      .get('/api/mock/scenarios')
      .expect(200);
    expect(listResponse.body.manifests).toHaveLength(5);

    const selectResponse = await request(app.getHttpServer())
      .put('/api/mock/scenarios/playwright-1')
      .send({ packs: ['dense', 'degraded'] })
      .expect(200);
    expect(selectResponse.body.packs).toEqual([
      'baseline',
      'dense',
      'degraded',
    ]);

    const snapshotResponse = await request(app.getHttpServer())
      .get('/api/mock/scenarios/playwright-1/fixtures')
      .expect(200);
    expect(snapshotResponse.body.summary.users).toBe(450);
    expect(snapshotResponse.body.selection.traits.degraded).toBe(true);

    await request(app.getHttpServer())
      .delete('/api/mock/scenarios/playwright-1')
      .expect(200)
      .expect(({ body }) => {
        expect(body.packs).toEqual(['baseline']);
      });
  });

  it('keeps parallel worker namespaces independent', async () => {
    await request(app.getHttpServer())
      .put('/api/mock/scenarios/worker-a')
      .send({ packs: ['empty'] })
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/mock/scenarios/worker-b')
      .send({ packs: ['moderation-heavy'] })
      .expect(200);

    const [workerA, workerB] = await Promise.all([
      request(app.getHttpServer()).get('/api/mock/scenarios/worker-a/fixtures'),
      request(app.getHttpServer()).get('/api/mock/scenarios/worker-b/fixtures'),
    ]);

    expect(workerA.status).toBe(200);
    expect(workerA.body.summary.totalRecords).toBe(0);
    expect(workerB.status).toBe(200);
    expect(workerB.body.selection.traits.moderationHeavy).toBe(true);
  });

  it('rejects malformed selections with a 400 response', async () => {
    await request(app.getHttpServer())
      .put('/api/mock/scenarios/worker-c')
      .send({ packs: ['empty', 'dense'] })
      .expect(400);

    await request(app.getHttpServer())
      .put('/api/mock/scenarios/worker-c')
      .send({ packs: [] })
      .expect(400);
  });

  it('hides the API when explicit mock mode is disabled', async () => {
    process.env.MOCK_BACKEND_MODE = 'disabled';
    await request(app.getHttpServer()).get('/api/mock/scenarios').expect(404);
    process.env.MOCK_BACKEND_MODE = 'test';
  });
});
