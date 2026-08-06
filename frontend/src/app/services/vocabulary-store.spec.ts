import { TestBed } from '@angular/core/testing';

import { VocabularyStore } from './vocabulary-store';

describe('VocabularyStore', () => {
  let service: VocabularyStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VocabularyStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
