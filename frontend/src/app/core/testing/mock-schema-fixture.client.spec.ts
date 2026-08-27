import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigurationService } from '../config/configuration.service';
import { MockSchemaFixtureClient } from './mock-schema-fixture.client';

describe('MockSchemaFixtureClient', () => {
  let service: MockSchemaFixtureClient;
  let httpMock: HttpTestingController;
  const configuration = {
    isMockBackend: true,
    config: { apiEndpoint: 'http://127.0.0.1:3000/api' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MockSchemaFixtureClient,
        { provide: ConfigurationService, useValue: configuration },
      ],
    });
    service = TestBed.inject(MockSchemaFixtureClient);
    httpMock = TestBed.inject(HttpTestingController);
    configuration.isMockBackend = true;
  });

  afterEach(() => httpMock.verify());

  it('consumes the authoritative response-factory index', async () => {
    const promise = service.listResponseFactories();
    httpMock.expectOne('http://127.0.0.1:3000/api/mock/schema-fixtures/responses').flush({
      seedId: 'elgl-offline-fixtures@mulberry32-v1:7937',
      factories: [
        {
          id: 'GET /version 200',
          method: 'get',
          path: '/version',
          status: '200',
          mediaType: 'application/json',
          operationId: 'getVersion',
        },
      ],
    });

    await expect(promise).resolves.toEqual([
      expect.objectContaining({ id: 'GET /version 200', operationId: 'getVersion' }),
    ]);
  });

  it('requests a deterministic fixture with explicit overrides', async () => {
    const promise = service.createResponseFixture({
      method: 'get',
      path: '/version',
      status: '200',
      seed: 7937,
      overrides: { minimumSupportedVersion: '2.0.0' },
    });
    const request = httpMock.expectOne(
      'http://127.0.0.1:3000/api/mock/schema-fixtures/responses',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(
      expect.objectContaining({ seed: 7937, path: '/version' }),
    );
    request.flush({
      descriptor: {
        id: 'GET /version 200',
        method: 'get',
        path: '/version',
        status: '200',
        mediaType: 'application/json',
      },
      seed: 7937,
      seedId: 'elgl-offline-fixtures@mulberry32-v1:7937',
      payload: { minimumSupportedVersion: '2.0.0' },
    });

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        seed: 7937,
        payload: { minimumSupportedVersion: '2.0.0' },
      }),
    );
  });

  it('fails before network access when mock mode is disabled', async () => {
    configuration.isMockBackend = false;

    await expect(service.listResponseFactories()).rejects.toThrow(
      'available only in explicit mock mode',
    );
  });

  it('rejects malformed server payloads instead of exposing them to tests', async () => {
    const promise = service.createResponseFixture({
      method: 'get',
      path: '/version',
      status: '200',
    });
    httpMock
      .expectOne('http://127.0.0.1:3000/api/mock/schema-fixtures/responses')
      .flush({ descriptor: null, seed: 7937, seedId: 'fixture', payload: {} });

    await expect(promise).rejects.toThrow('Invalid mock response fixture payload');
  });
});
