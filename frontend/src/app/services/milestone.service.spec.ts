import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MilestoneService } from './milestone.service';

describe('MilestoneService', () => {
  let service: MilestoneService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MilestoneService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMilestones', () => {
    it('GETs the milestones list', async () => {
      const promise = service.getMilestones();
      const req = httpMock.expectOne('http://127.0.0.1:3000/api/milestones');
      expect(req.request.method).toBe('GET');
      req.flush([{ id: '1', title: 'Complete 10 flashcards', completed: false }]);

      await expect(promise).resolves.toEqual([
        { id: '1', title: 'Complete 10 flashcards', completed: false },
      ]);
    });
  });

  describe('getProgress', () => {
    it('GETs the progress summary', async () => {
      const promise = service.getProgress();
      const req = httpMock.expectOne('http://127.0.0.1:3000/api/milestones/progress');
      expect(req.request.method).toBe('GET');
      req.flush({ total: 2, completed: 1, percentage: 50 });

      await expect(promise).resolves.toEqual({ total: 2, completed: 1, percentage: 50 });
    });
  });

  describe('createMilestone', () => {
    it('POSTs a new milestone', async () => {
      const promise = service.createMilestone('Learn 10 words', 'Vocabulary goal');
      const req = httpMock.expectOne('http://127.0.0.1:3000/api/milestones');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        title: 'Learn 10 words',
        description: 'Vocabulary goal',
      });
      req.flush({ id: '2', title: 'Learn 10 words', completed: false });

      await expect(promise).resolves.toEqual({
        id: '2',
        title: 'Learn 10 words',
        completed: false,
      });
    });
  });

  describe('markCompleted', () => {
    it('POSTs to the complete endpoint', async () => {
      const promise = service.markCompleted('1');
      const req = httpMock.expectOne('http://127.0.0.1:3000/api/milestones/1/complete');
      expect(req.request.method).toBe('POST');
      req.flush({ id: '1', title: 'Complete 10 flashcards', completed: true });

      await expect(promise).resolves.toEqual({
        id: '1',
        title: 'Complete 10 flashcards',
        completed: true,
      });
    });
  });

  describe('deleteMilestone', () => {
    it('DELETEs the milestone', async () => {
      const promise = service.deleteMilestone('1');
      const req = httpMock.expectOne('http://127.0.0.1:3000/api/milestones/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);

      await expect(promise).resolves.toBeFalsy();
    });
  });
});
