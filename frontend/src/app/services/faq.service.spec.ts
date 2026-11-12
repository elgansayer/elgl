import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { FAQ } from '../models/faq.model';
import { FaqService } from './faq.service';

describe('FaqService', () => {
  let service: FaqService;
  let httpMock: HttpTestingController;

  const faqsUrl = `${environment.apiUrl}/help/faqs`;

  const mockFaqs: FAQ[] = [
    {
      id: 'faq-1',
      question: 'How do I reset my password?',
      answer: 'Use the reset link on the sign-in page.',
      category: 'account',
    },
    {
      id: 'faq-2',
      question: 'How do I report a user?',
      answer: 'Open their profile menu and choose report.',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FaqService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(FaqService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('requests the FAQ list from the help API under the configured apiUrl', async () => {
    const promise = service.getFaqs();

    const req = httpMock.expectOne(faqsUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockFaqs);

    await expect(promise).resolves.toEqual(mockFaqs);
  });

  it('resolves an empty list when the API returns no FAQs', async () => {
    const promise = service.getFaqs();

    httpMock.expectOne(faqsUrl).flush([]);

    await expect(promise).resolves.toEqual([]);
  });

  it('rejects with the HTTP error when the API call fails', async () => {
    const promise = service.getFaqs();

    httpMock
      .expectOne(faqsUrl)
      .flush({ message: 'Server error' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toMatchObject({ status: 500 });
  });
});
