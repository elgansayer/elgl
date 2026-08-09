import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TourService } from './tour.service';

describe('TourService', () => {
  let service: TourService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TourService],
    });
    service = TestBed.inject(TourService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should be a no-op (tour disabled)', () => {
    expect(() => service.startEconomyTour()).not.toThrow();
  });
});