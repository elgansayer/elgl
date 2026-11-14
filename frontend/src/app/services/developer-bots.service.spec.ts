import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { DeveloperBotsService } from './developer-bots.service';

describe('DeveloperBotsService', () => {
  let service: DeveloperBotsService;
  let http: HttpTestingController;

  const bot = {
    id: '11111111-1111-4111-8111-111111111111',
    owner_id: 'user-1',
    display_name: 'Chef Ana',
    persona: 'A cheerful Spanish chef',
    target_language: 'es',
    tone: 'playful' as const,
    greeting: 'Hola',
    is_enabled: true,
    created_at: '2026-11-14T00:00:00.000Z',
    updated_at: '2026-11-14T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token-1' },
        },
      ],
    });
    service = TestBed.inject(DeveloperBotsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the caller bots with a bearer token', async () => {
    const promise = service.listBots();
    const request = http.expectOne(`${environment.apiUrl}/developer-bots`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush([bot]);

    await expect(promise).resolves.toEqual([bot]);
  });

  it('creates a bot', async () => {
    const input = {
      display_name: 'Chef Ana',
      persona: 'A cheerful Spanish chef',
      target_language: 'es',
      tone: 'playful' as const,
      greeting: 'Hola',
    };
    const promise = service.createBot(input);
    const request = http.expectOne(`${environment.apiUrl}/developer-bots`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush(bot);

    await expect(promise).resolves.toEqual(bot);
  });

  it('updates a bot by id', async () => {
    const promise = service.updateBot(bot.id, { display_name: 'Chef Ana 2' });
    const request = http.expectOne(`${environment.apiUrl}/developer-bots/${bot.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ display_name: 'Chef Ana 2' });
    request.flush({ ...bot, display_name: 'Chef Ana 2' });

    await expect(promise).resolves.toMatchObject({
      display_name: 'Chef Ana 2',
    });
  });

  it('deletes a bot by id', async () => {
    const promise = service.deleteBot(bot.id);
    const request = http.expectOne(`${environment.apiUrl}/developer-bots/${bot.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await expect(promise).resolves.toBeNull();
  });
});
