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
      providers: [ConfigurationService]
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

  it('should return fallback config if accessed before initialization', () => {
    const config = service.config;
    expect(config.environment).toBe('fallback');
  });

  it('should load configuration successfully', async () => {
    const mockConfig: AppConfig = {
      apiEndpoint: 'https://test.api.com',
      appName: 'TestApp',
      version: '1.0.0',
      environment: 'test'
    };

    const loadPromise = service.loadConfiguration();

    const req = httpMock.expectOne('./assets/config.json');
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);

    await loadPromise;

    expect(service.config).toEqual(mockConfig);
  });

  it('should use fallback configuration on error', async () => {
    const loadPromise = service.loadConfiguration();

    const req = httpMock.expectOne('./assets/config.json');
    req.error(new ProgressEvent('Network error'));

    await loadPromise;

    expect(service.config.environment).toBe('fallback');
  });
});
