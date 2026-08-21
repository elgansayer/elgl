import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { VersionCheckService } from './version-check.service';

describe('VersionCheckService', () => {
  let service: VersionCheckService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [VersionCheckService],
    });

    service = TestBed.inject(VersionCheckService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialise isDeprecated as false', () => {
    expect(service.isDeprecated()).toBe(false);
  });

  it('should expose reactive isDeprecated signal', () => {
    expect(typeof service.isDeprecated()).toBe('boolean');
  });
});