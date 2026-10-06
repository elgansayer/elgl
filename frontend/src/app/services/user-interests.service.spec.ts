import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserInterestsService } from './user-interests.service';

describe('UserInterestsService', () => {
  let service: UserInterestsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserInterestsService]
    });
    service = TestBed.inject(UserInterestsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get user tags', async () => {
    const mockTags = { tags: ['music', 'travel'] };
    const promise = service.getUserTags();
    const req = httpMock.expectOne('/api/user-interests/tags');
    expect(req.request.method).toBe('GET');
    req.flush(mockTags);
    const result = await promise;
    expect(result).toEqual(['music', 'travel']);
  });

  it('should update user tags', async () => {
    const promise = service.updateUserTags(['music']);
    const req = httpMock.expectOne('/api/user-interests/tags');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tags: ['music'] });
    req.flush({ success: true });
    await promise;
  });

  it('should get vocabulary', async () => {
    const mockVocab = {
      entries: [
        { interestTag: 'music', vocabWord: 'guitar', translation: 'guitare', srsLevel: 0 }
      ]
    };
    const promise = service.getVocabulary('fr');
    const req = httpMock.expectOne('/api/user-interests/vocabulary?language=fr');
    expect(req.request.method).toBe('GET');
    req.flush(mockVocab);
    const result = await promise;
    expect(result).toEqual(mockVocab.entries);
  });
});
