import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { StudyStreakService } from './study-streak.service';
import { environment } from '../../environments/environment';

describe.skip('StudyStreakService', () => {
  let service: StudyStreakService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StudyStreakService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(StudyStreakService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe.skip('getStreak', () => {
    it('should fetch the current streak', async () => {
      const expected = { streak: 7 };

      const promise = firstValueFrom(service.getStreak());

      const req = httpTesting.expectOne(`${environment.apiUrl}/study-streak/me`);
      expect(req.request.method).toBe('GET');
      req.flush(expected);

      await promise.then((result) => expect(result).toEqual(expected));
    });
  });

  describe.skip('checkin', () => {
    it('should submit a checkin and return the updated streak', async () => {
      const expected = { streak: 8 };

      const promise = firstValueFrom(service.checkin());

      const req = httpTesting.expectOne(
        `${environment.apiUrl}/study-streak/checkin`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(expected);

      await promise.then((result) => expect(result).toEqual(expected));
    });
  });
});
