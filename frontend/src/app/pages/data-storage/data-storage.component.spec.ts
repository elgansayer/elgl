import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { DataStorageComponent } from './data-storage.component';
import { DataStorageService } from '../../services/data-storage.service';
import { CacheService } from '../../services/cache.service';

describe('DataStorageComponent', () => {
  let component: DataStorageComponent;
  let dataStorageService: DataStorageService;
  let cacheServiceSpy: { clearCache: ReturnType<typeof vi.fn>; deleteOldMedia: ReturnType<typeof vi.fn> };
  let locationSpy: { back: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    cacheServiceSpy = {
      clearCache: vi.fn().mockResolvedValue(undefined),
      deleteOldMedia: vi.fn().mockResolvedValue(undefined),
    };
    locationSpy = { back: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DataStorageComponent],
      providers: [
        { provide: CacheService, useValue: cacheServiceSpy },
        DataStorageService,
        { provide: Location, useValue: locationSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DataStorageComponent);
    component = fixture.componentInstance;
    dataStorageService = TestBed.inject(DataStorageService);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle cellular auto download', () => {
    const initial = dataStorageService.cellularAutoDownload();
    component.toggleCellular();
    expect(dataStorageService.cellularAutoDownload()).toBe(!initial);
  });

  it('should clear cache and set success message', async () => {
    await component.clearCache();
    expect(cacheServiceSpy.clearCache).toHaveBeenCalled();
    expect(component.successMessage()).toBe('dataStorage.cacheClearedSuccess');
  });

  it('should set error when cache clear fails', async () => {
    cacheServiceSpy.clearCache.mockRejectedValueOnce(new Error('fail'));
    await component.clearCache();
    expect(component.errorMessage()).toBe('common.error_occurred');
  });

  it('should delete old media and set success message', async () => {
    await component.deleteOldMedia();
    expect(cacheServiceSpy.deleteOldMedia).toHaveBeenCalled();
    expect(component.successMessage()).toBe('dataStorage.oldMediaDeletedSuccess');
  });

  it('should set error when delete old media fails', async () => {
    cacheServiceSpy.deleteOldMedia.mockRejectedValueOnce(new Error('fail'));
    await component.deleteOldMedia();
    expect(component.errorMessage()).toBe('common.error_occurred');
  });

  it('should set download success message', async () => {
    await component.downloadMyData();
    expect(component.successMessage()).toBe('dataStorage.downloadStarted');
  });

  it('should compute zero storage when estimate is null', () => {
    expect(component.storageUsedPercent()).toBe(0);
    expect(component.storageUsedLabel()).toBe('');
    expect(component.totalStorageLabel()).toBe('');
  });

  it('should go back via Location', () => {
    component.goBack();
    expect(locationSpy.back).toHaveBeenCalled();
  });
});