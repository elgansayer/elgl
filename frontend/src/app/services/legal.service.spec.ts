import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LegalService, LegalDocument } from './legal.service';
import { environment } from '../../environments/environment';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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

  it('should fetch Terms of Service', async () => {
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

    const result = await resultPromise;
    expect(result).toEqual(mockDoc);
  });

  it('should fetch Privacy Policy', async () => {
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

    const result = await resultPromise;
    expect(result).toEqual(mockDoc);
  });

  it('should handle HTTP errors for Terms of Service', async () => {
    const resultPromise = service.fetchTermsOfService();

    const req = httpMock.expectOne(`${baseUrl}/terms`);
    req.error(new ProgressEvent('Network error'));

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('should handle HTTP errors for Privacy Policy', async () => {
    const resultPromise = service.fetchPrivacyPolicy();

    const req = httpMock.expectOne(`${baseUrl}/privacy`);
    req.error(new ProgressEvent('Network error'));

    await expect(resultPromise).rejects.toBeTruthy();
  });
});