import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { GlobalErrorHandler } from './error-handler.service';

describe('GlobalErrorHandler privacy contract', () => {
  let handler: GlobalErrorHandler;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: AuthService, useValue: { getAccessToken: vi.fn().mockReturnValue(null) } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('removes query strings and fragments from reported request URLs', () => {
    const error = new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error',
      url: 'https://api.example.com/private/path?token=secret#message',
    });

    expect(() => handler.handleError(error)).toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body.url).toBe('https://api.example.com/private/path');
    expect(JSON.stringify(req.request.body)).not.toContain('token=secret');
    req.flush({ status: 'logged' });
  });

  it('bounds oversized crash messages and stack traces before transmission', () => {
    const error = new Error('m'.repeat(5000));
    Object.defineProperty(error, 'stack', {
      value: `Error: big\n${'    at fn (bundle.js:10:20)\n'.repeat(1000)}`,
    });

    handler.handleError(error);

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body.message).toHaveLength(1000);
    expect(req.request.body.stack.length).toBeLessThanOrEqual(12000);
    expect(req.request.body.stackFrames.length).toBeLessThanOrEqual(30);
    req.flush({ status: 'logged' });
  });

  it('deduplicates identical crashes while the first report is in flight', () => {
    const first = new Error('same crash');
    const second = new Error('same crash');

    handler.handleError(first);
    handler.handleError(second);

    const requests = httpTesting.match('/api/analytics/client-error');
    expect(requests).toHaveLength(1);
    requests[0].flush({ status: 'logged' });
  });
});
