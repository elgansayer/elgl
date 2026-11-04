import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';

describe('public legal document routes over HTTP', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LegalController],
      providers: [LegalService],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['/api/legal/terms', 'Terms of Service'],
    ['/api/legal/terms-of-service', 'Terms of Service'],
    ['/api/legal/privacy', 'Privacy Policy'],
    ['/api/legal/privacy-policy', 'Privacy Policy'],
  ])('serves %s through the registered route', async (path, title) => {
    const response = await request(app.getHttpServer()).get(path).expect(200);

    expect(response.body.title).toBe(title);
    expect(response.body.sections.length).toBeGreaterThan(0);
    expect(response.headers['cache-control']).toBe(
      'public, max-age=300, stale-while-revalidate=86400',
    );
  });

  it('returns 404 for an unsupported document type', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/legal/cookie-policy')
      .expect(404);

    expect(response.body.message).toBe('Legal document not found');
  });

  it('does not expose the removed duplicate document route', async () => {
    await request(app.getHttpServer())
      .get('/api/legal/document/terms')
      .expect(404);
  });
});
