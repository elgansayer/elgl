import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { LegalDocument, LegalService } from './legal.service';

describe('LegalService', () => {
  let service: LegalService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/legal`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LegalService],
    });
    service = TestBed.inject(LegalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches and validates Terms of Service', async () => {
    const mockDoc: LegalDocument = {
      title: 'Terms of Service',
      lastUpdated: '2026-08-01',
      sections: [
        { id: 'acceptance', heading: '1. Acceptance of Terms', content: 'Test content.' },
      ],
    };

    const resultPromise = service.fetchTermsOfService();

    const req = httpMock.expectOne(`${baseUrl}/terms`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDoc);

    await expect(resultPromise).resolves.toEqual(mockDoc);
  });

  it('fetches and validates Privacy Policy', async () => {
    const mockDoc: LegalDocument = {
      title: 'Privacy Policy',
      lastUpdated: '2026-08-01',
      sections: [
        { id: 'info-collect', heading: '1. Information We Collect', content: 'Test content.' },
      ],
    };

    const resultPromise = service.fetchPrivacyPolicy();

    const req = httpMock.expectOne(`${baseUrl}/privacy`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDoc);

    await expect(resultPromise).resolves.toEqual(mockDoc);
  });

  it('normalizes surrounding whitespace from a valid response', async () => {
    const resultPromise = service.fetchTermsOfService();
    httpMock.expectOne(`${baseUrl}/terms`).flush({
      title: '  Terms of Service  ',
      lastUpdated: '2026-08-01',
      sections: [
        {
          id: 'acceptance',
          heading: '  1. Acceptance of Terms  ',
          content: '  Test content.  ',
        },
      ],
    });

    await expect(resultPromise).resolves.toEqual({
      title: 'Terms of Service',
      lastUpdated: '2026-08-01',
      sections: [
        { id: 'acceptance', heading: '1. Acceptance of Terms', content: 'Test content.' },
      ],
    });
  });

  it('rejects malformed or impossible effective dates', async () => {
    const resultPromise = service.fetchTermsOfService();
    httpMock.expectOne(`${baseUrl}/terms`).flush({
      title: 'Terms of Service',
      lastUpdated: '2026-02-30',
      sections: [{ id: 'acceptance', heading: 'Acceptance', content: 'Content' }],
    });

    await expect(resultPromise).rejects.toThrow('Invalid legal document response');
  });

  it('rejects duplicate or unsafe section identifiers', async () => {
    const resultPromise = service.fetchPrivacyPolicy();
    httpMock.expectOne(`${baseUrl}/privacy`).flush({
      title: 'Privacy Policy',
      lastUpdated: '2026-08-01',
      sections: [
        { id: 'rights', heading: 'Rights', content: 'First' },
        { id: 'rights', heading: 'Rights again', content: 'Second' },
      ],
    });

    await expect(resultPromise).rejects.toThrow('Invalid legal document response');
  });

  it('rejects empty and unbounded document payloads', async () => {
    const emptyPromise = service.fetchTermsOfService();
    httpMock.expectOne(`${baseUrl}/terms`).flush({
      title: 'Terms of Service',
      lastUpdated: '2026-08-01',
      sections: [],
    });
    await expect(emptyPromise).rejects.toThrow('Invalid legal document response');

    const oversizedPromise = service.fetchTermsOfService();
    httpMock.expectOne(`${baseUrl}/terms`).flush({
      title: 'Terms of Service',
      lastUpdated: '2026-08-01',
      sections: [
        {
          id: 'acceptance',
          heading: 'Acceptance',
          content: 'x'.repeat(20_001),
        },
      ],
    });
    await expect(oversizedPromise).rejects.toThrow('Invalid legal document response');
  });

  it('propagates HTTP errors for Terms of Service', async () => {
    const resultPromise = service.fetchTermsOfService();

    const req = httpMock.expectOne(`${baseUrl}/terms`);
    req.error(new ProgressEvent('Network error'));

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('propagates HTTP errors for Privacy Policy', async () => {
    const resultPromise = service.fetchPrivacyPolicy();

    const req = httpMock.expectOne(`${baseUrl}/privacy`);
    req.error(new ProgressEvent('Network error'));

    await expect(resultPromise).rejects.toBeTruthy();
  });
});
