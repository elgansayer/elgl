import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { MutedWordsApiService } from './muted-words-api.service';

describe('MutedWordsApiService', () => {
  let service: MutedWordsApiService;
  let http: HttpTestingController;
  const endpoint = `${environment.apiUrl}/safety/muted-words`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MutedWordsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(MutedWordsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads and normalises canonical account preferences', async () => {
    const promise = service.list();
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('GET');
    request.flush({ words: [' SPOILER ', 'ＳＰＯＩＬＥＲ', 'café', 42] });

    await expect(promise).resolves.toEqual(['spoiler', 'café']);
  });

  it('adds a word with the authenticated JSON API', async () => {
    const promise = service.add('spoiler');
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ word: 'spoiler' });
    request.flush({ words: ['spoiler'] });

    await expect(promise).resolves.toEqual(['spoiler']);
  });

  it('removes a word with a body instead of putting private terms in the URL', async () => {
    const promise = service.remove('spoiler');
    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ word: 'spoiler' });
    request.flush({ words: [] });

    await expect(promise).resolves.toEqual([]);
  });

  it('rejects malformed server payloads instead of trusting unbounded state', async () => {
    const promise = service.list();
    http.expectOne(endpoint).flush({ words: 'not-an-array' });

    await expect(promise).rejects.toThrow('Invalid muted words response');
  });
});
