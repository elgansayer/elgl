import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ConfigurationService } from './configuration.service';
import { AppConfig } from './app-config.interface';

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigurationService],
    });

    service = TestBed.inject(ConfigurationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return a non-mock fallback config before initialization', () => {
    expect(service.config.environment).toBe('fallback');
    expect(service.mockBackendMode).toBe('disabled');
    expect(service.isMockBackend).toBe(false);
  });

  it('should load ordinary configuration with mock mode disabled', async () => {
    const mockConfig: AppConfig = {
      apiEndpoint: 'https://test.api.com',
      appName: 'TestApp',
      version: '1.0.0',
      environment: 'test',
    };

    const loadPromise = service.loadConfiguration();
    const req = httpMock.expectOne('./assets/config.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);
    await loadPromise;

    expect(service.config).toEqual({
      ...mockConfig,
      mockBackendMode: 'disabled',
    });
    expect(service.isMockBackend).toBe(false);
  });

  it.each(['local', 'test', 'demo'] as const)(
    'accepts explicit %s mock mode in a local client profile',
    async (mode) => {
      const loadPromise = service.loadConfiguration();
      httpMock.expectOne('./assets/config.json').flush({
        apiEndpoint: 'http://127.0.0.1:3000/api',
        appName: 'ELGL Offline',
        version: '1.0.0',
        environment: 'development',
        mockBackendMode: mode,
      } satisfies AppConfig);
      await loadPromise;

      expect(service.mockBackendMode).toBe(mode);
      expect(service.isMockBackend).toBe(true);
    },
  );

  it('fails closed when production config attempts to enable fixtures', async () => {
    const loadPromise = service.loadConfiguration();
    httpMock.expectOne('./assets/config.json').flush({
      apiEndpoint: 'https://api.example.test',
      appName: 'ELGL',
      version: '1.0.0',
      environment: 'production',
      mockBackendMode: 'demo',
    } satisfies AppConfig);
    await loadPromise;

    expect(service.config.environment).toBe('fallback');
    expect(service.mockBackendMode).toBe('disabled');
    expect(service.isMockBackend).toBe(false);
  });

  it('fails closed for an invalid runtime mock mode', async () => {
    const loadPromise = service.loadConfiguration();
    httpMock.expectOne('./assets/config.json').flush({
      apiEndpoint: 'http://127.0.0.1:3000/api',
      appName: 'ELGL',
      version: '1.0.0',
      environment: 'development',
      mockBackendMode: 'automatic',
    });
    await loadPromise;

    expect(service.mockBackendMode).toBe('disabled');
  });

  it('should use a non-mock fallback configuration on network error', async () => {
    const loadPromise = service.loadConfiguration();

    const req = httpMock.expectOne('./assets/config.json');
    req.error(new ProgressEvent('Network error'));

    await loadPromise;

    expect(service.config.environment).toBe('fallback');
    expect(service.mockBackendMode).toBe('disabled');
  });
});
