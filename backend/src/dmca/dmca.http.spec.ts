import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { DmcaController } from './dmca.controller';
import { DmcaService } from './dmca.service';

const MOMENT = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const NOTICE = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';

const validNotice = {
  claimantName: 'Ana Costa',
  claimantEmail: 'ana@example.com',
  copyrightedWork: 'The song "Mar" released in 2019',
  materialReferences: [MOMENT],
  goodFaithStatement: true,
  accuracyStatement: true,
  electronicSignature: 'Ana Costa',
};

const validCounter = {
  fullName: 'Sam Lee',
  address: '1 Road, Town',
  goodFaithStatement: true,
  jurisdictionConsent: true,
  electronicSignature: 'Sam Lee',
};

describe('DMCA routes over HTTP', () => {
  let app: INestApplication;
  const service = {
    submitNotice: vi.fn(),
    verifyNotice: vi.fn(),
    listOwnerNotices: vi.fn(),
    submitCounterNotice: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    service.submitNotice.mockResolvedValue({
      references: ['DMCA-AAAAAAAAAA'],
      status: 'pending_verification',
    });
    service.verifyNotice.mockResolvedValue({ notices: [] });
    service.listOwnerNotices.mockResolvedValue([]);
    service.submitCounterNotice.mockResolvedValue({ id: NOTICE });

    const moduleRef = await Test.createTestingModule({
      controllers: [DmcaController],
      providers: [
        SupabaseAuthGuard,
        { provide: DmcaService, useValue: service },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              auth: {
                getUser: (token: string) =>
                  Promise.resolve(
                    token === 'owner-token'
                      ? { data: { user: { id: 'owner-1' } }, error: null }
                      : { data: { user: null }, error: { message: 'invalid' } },
                  ),
              },
            }),
          },
        },
      ],
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

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('public submission', () => {
    it('accepts a complete notice without authentication and never caches the answer', async () => {
      const response = await http()
        .post('/api/dmca/notices')
        .send(validNotice)
        .expect(202);

      expect(response.body).toEqual({
        references: ['DMCA-AAAAAAAAAA'],
        status: 'pending_verification',
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(service.submitNotice).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an unaccepted good faith statement', { goodFaithStatement: false }],
      ['an unaccepted accuracy statement', { accuracyStatement: false }],
      ['a malformed email', { claimantEmail: 'ana@' }],
      ['no material', { materialReferences: [] }],
      [
        'too many items',
        { materialReferences: Array.from({ length: 11 }, (_, i) => `r${i}`) },
      ],
      ['an unknown field', { status: 'content_disabled' }],
    ])('rejects %s before the service is reached', async (_label, override) => {
      await http()
        .post('/api/dmca/notices')
        .send({ ...validNotice, ...override })
        .expect(400);
      expect(service.submitNotice).not.toHaveBeenCalled();
    });
  });

  describe('confirmation', () => {
    it('is public and takes only a well-formed token', async () => {
      await http()
        .post('/api/dmca/notices/verify')
        .send({ token: 'A'.repeat(43) })
        .expect(200, { notices: [] });

      await http()
        .post('/api/dmca/notices/verify')
        .send({ token: 'short' })
        .expect(400);
      await http()
        .post('/api/dmca/notices/verify')
        .send({ token: 'A'.repeat(43), extra: 1 })
        .expect(400);
      expect(service.verifyNotice).toHaveBeenCalledTimes(1);
    });
  });

  describe('content owner routes', () => {
    it('require a signed-in user', async () => {
      await http().get('/api/dmca/notices/mine').expect(401);
      await http()
        .post(`/api/dmca/notices/${NOTICE}/counter-notice`)
        .send(validCounter)
        .expect(401);
      await http()
        .get('/api/dmca/notices/mine')
        .set('Authorization', 'Bearer forged')
        .expect(401);
      expect(service.listOwnerNotices).not.toHaveBeenCalled();
    });

    it('list only the caller notices and bound the page size', async () => {
      await http()
        .get('/api/dmca/notices/mine?page=2&pageSize=10')
        .set('Authorization', 'Bearer owner-token')
        .expect(200, []);
      expect(service.listOwnerNotices).toHaveBeenCalledWith('owner-1', 2, 10);

      await http()
        .get('/api/dmca/notices/mine?pageSize=500')
        .set('Authorization', 'Bearer owner-token')
        .expect(400);
    });

    it('take the owner from the token, never from the request', async () => {
      await http()
        .post(`/api/dmca/notices/${NOTICE}/counter-notice`)
        .set('Authorization', 'Bearer owner-token')
        .send(validCounter)
        .expect(200);

      expect(service.submitCounterNotice).toHaveBeenCalledWith(
        'owner-1',
        NOTICE,
        expect.objectContaining({ fullName: 'Sam Lee' }),
      );

      await http()
        .post(`/api/dmca/notices/${NOTICE}/counter-notice`)
        .set('Authorization', 'Bearer owner-token')
        .send({ ...validCounter, ownerId: 'someone-else' })
        .expect(400);
    });

    it('reject a malformed notice id and an incomplete statement', async () => {
      await http()
        .post('/api/dmca/notices/not-a-uuid/counter-notice')
        .set('Authorization', 'Bearer owner-token')
        .send(validCounter)
        .expect(400);
      await http()
        .post(`/api/dmca/notices/${NOTICE}/counter-notice`)
        .set('Authorization', 'Bearer owner-token')
        .send({ ...validCounter, jurisdictionConsent: false })
        .expect(400);
      expect(service.submitCounterNotice).not.toHaveBeenCalled();
    });
  });
});
