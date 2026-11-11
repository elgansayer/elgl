import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MetricsService } from '../src/metrics/metrics.service';
import { ClientVersionGuard } from '../src/version/client-version.guard';
import { VersionController } from '../src/version/version.controller';
import { VersionService } from '../src/version/version.service';

@Controller('probe')
class ProbeController {
  @Get()
  read() {
    return { ok: true };
  }
}

describe('Client version enforcement E2E', () => {
  let app: INestApplication;
  const recordClientVersionCheck = vi.fn();

  const bootstrap = async (): Promise<void> => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VersionController, ProbeController],
      providers: [
        VersionService,
        ClientVersionGuard,
        { provide: APP_GUARD, useExisting: ClientVersionGuard },
        { provide: MetricsService, useValue: { recordClientVersionCheck } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  beforeEach(() => {
    recordClientVersionCheck.mockReset();
    process.env.MINIMUM_SUPPORTED_APP_VERSION = '2.0.0';
    delete process.env.CLIENT_VERSION_ENFORCEMENT;
    delete process.env.GITHUB_REPO;
  });

  afterEach(async () => {
    await app.close();
    delete process.env.MINIMUM_SUPPORTED_APP_VERSION;
    delete process.env.CLIENT_VERSION_ENFORCEMENT;
  });

  it('answers HTTP 426 with the machine-readable policy to an outdated client', async () => {
    await bootstrap();

    const response = await request(app.getHttpServer())
      .get('/probe')
      .set('X-App-Version', '1.4.0')
      .expect(426);

    expect(response.body).toMatchObject({
      statusCode: 426,
      code: 'CLIENT_UPGRADE_REQUIRED',
      minimumSupported: '2.0.0',
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('serves supported, unidentified and malformed clients normally', async () => {
    await bootstrap();

    await request(app.getHttpServer())
      .get('/probe')
      .set('X-App-Version', '2.0.0')
      .expect(200);
    await request(app.getHttpServer()).get('/probe').expect(200);
    await request(app.getHttpServer())
      .get('/probe')
      .set('X-App-Version', 'not-a-version')
      .expect(200);
  });

  it('keeps the version policy readable for outdated clients', async () => {
    await bootstrap();

    const minimum = await request(app.getHttpServer())
      .get('/version/minimum')
      .set('X-App-Version', '0.0.1')
      .expect(200);
    expect(minimum.body).toEqual({ minimumSupported: '2.0.0' });

    const check = await request(app.getHttpServer())
      .get('/version/check')
      .set('X-App-Version', '0.0.1')
      .expect(200);
    expect(check.body).toMatchObject({
      status: 'upgrade_required',
      minimumSupported: '2.0.0',
    });
    expect(check.headers['cache-control']).toBe('no-store');
  });

  it('classifies a missing header as unknown on the handshake', async () => {
    await bootstrap();

    const response = await request(app.getHttpServer())
      .get('/version/check')
      .expect(200);

    expect(response.body.status).toBe('unknown');
  });

  it('does not reject anything in report-only mode', async () => {
    process.env.CLIENT_VERSION_ENFORCEMENT = 'report-only';
    await bootstrap();

    await request(app.getHttpServer())
      .get('/probe')
      .set('X-App-Version', '1.0.0')
      .expect(200);

    expect(recordClientVersionCheck).toHaveBeenCalledWith('report_only');
  });
});
