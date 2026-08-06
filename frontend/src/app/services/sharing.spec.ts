import { TestBed } from '@angular/core/testing';

import { Sharing } from './sharing';

describe('Sharing', () => {
  let service: Sharing;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sharing);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
