import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ProfileRelationshipService } from './profile-relationship.service';

describe('ProfileRelationshipService', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProfileRelationshipService,
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('token-123') },
        },
      ],
    });
    return {
      service: TestBed.inject(ProfileRelationshipService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('propagates follow failures so the component can roll back optimistic state', async () => {
    const { service, http } = setup();
    const requestPromise = service.follow('partner-1');
    const request = http.expectOne(`${environment.apiUrl}/users/partner-1/follow`);
    expect(request.request.method).toBe('POST');
    request.flush({ message: 'failed' }, { status: 503, statusText: 'Unavailable' });

    await expect(requestPromise).rejects.toBeTruthy();
    http.verify();
  });

  it('uses an authenticated delete request for unfollow', async () => {
    const { service, http } = setup();
    const requestPromise = service.unfollow('partner-1');
    const request = http.expectOne(`${environment.apiUrl}/users/partner-1/follow`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-123');
    request.flush(null);

    await expect(requestPromise).resolves.toBeUndefined();
    http.verify();
  });
});
